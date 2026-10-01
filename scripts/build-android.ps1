param([switch]$DebugWebView, [switch]$SkipWebBuild)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$androidRoot = Join-Path $workspace 'android'
$toolsRoot = Join-Path $workspace '.android-tools'
$jdk = (Get-ChildItem -LiteralPath (Join-Path $toolsRoot 'jdk') -Directory | Select-Object -First 1).FullName
$buildTools = Join-Path $toolsRoot 'build-tools/android-16'
$platform = Join-Path $toolsRoot 'platform/android-36/android.jar'
$java = Join-Path $jdk 'bin/java.exe'
$javac = Join-Path $jdk 'bin/javac.exe'
$keytool = Join-Path $jdk 'bin/keytool.exe'
$buildRoot = Join-Path $androidRoot 'build'
$assetsRoot = Join-Path $androidRoot 'assets/www'
$releaseRoot = Join-Path $workspace 'release'
foreach($path in @($java,$javac,$keytool,$platform,(Join-Path $buildTools 'aapt2.exe'))) {
    if(-not (Test-Path -LiteralPath $path)) { throw "Android build dependency missing: $path. See android/README.md." }
}
function Invoke-BuildTool([string]$executable, [string[]]$arguments) {
    & $executable @arguments
    if($LASTEXITCODE -ne 0) { throw "Build tool failed: $executable ($LASTEXITCODE)" }
}
Push-Location $workspace
try {
    if(-not $SkipWebBuild) { Invoke-BuildTool 'npm.cmd' @('run','build') }
    # Both directories are generated outputs. Check absolute paths before removal.
    foreach($path in @($buildRoot,$assetsRoot)) {
        $resolved = [IO.Path]::GetFullPath($path)
        if(-not $resolved.StartsWith($androidRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Generated path is outside Android project.' }
        if(Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
        New-Item -ItemType Directory -Path $resolved -Force | Out-Null
    }
    Copy-Item -Path (Join-Path $workspace 'dist/*') -Destination $assetsRoot -Recurse
    Copy-Item -LiteralPath (Join-Path $workspace 'node_modules/three/LICENSE') -Destination (Join-Path $assetsRoot 'THREE-LICENSE.txt')
    [xml]$manifest = Get-Content -LiteralPath (Join-Path $androidRoot 'AndroidManifest.xml')
    $manifest.manifest.application.SetAttribute('debuggable','http://schemas.android.com/apk/res/android',$DebugWebView.IsPresent.ToString().ToLower()) | Out-Null
    $stagedManifest = Join-Path $buildRoot 'AndroidManifest.xml'
    $manifest.Save($stagedManifest)
    $resources = Join-Path $buildRoot 'resources.zip'
    Invoke-BuildTool (Join-Path $buildTools 'aapt2.exe') @('compile','--dir',(Join-Path $androidRoot 'res'),'-o',$resources)
    $unsigned = Join-Path $buildRoot 'unsigned.apk'
    Invoke-BuildTool (Join-Path $buildTools 'aapt2.exe') @('link','-o',$unsigned,'-I',$platform,'--manifest',$stagedManifest,'--min-sdk-version','28','--target-sdk-version','36','-A',(Join-Path $androidRoot 'assets'),$resources)
    $classes = Join-Path $buildRoot 'classes'
    $dex = Join-Path $buildRoot 'dex'
    New-Item -ItemType Directory -Path $classes,$dex -Force | Out-Null
    $sources = @(Get-ChildItem -LiteralPath (Join-Path $androidRoot 'java') -Filter '*.java' -Recurse | ForEach-Object FullName)
    Invoke-BuildTool $javac (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$platform,'-d',$classes) + $sources)
    $classFiles = @(Get-ChildItem -LiteralPath $classes -Filter '*.class' -Recurse | ForEach-Object FullName)
    Invoke-BuildTool $java (@('-cp',(Join-Path $buildTools 'lib/d8.jar'),'com.android.tools.r8.D8','--lib',$platform,'--min-api','28','--output',$dex) + $classFiles)
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::Open($unsigned,[IO.Compression.ZipArchiveMode]::Update)
    try {
        # The standalone Windows aapt2 uses backslashes in nested asset entries.
        # Android AssetManager requires ZIP paths with forward slashes.
        foreach($entry in @($archive.Entries)) {
            if($entry.FullName.Contains('\')) {
                $replacement = $archive.CreateEntry($entry.FullName.Replace('\','/'),[IO.Compression.CompressionLevel]::Optimal)
                $inputStream = $entry.Open()
                $outputStream = $replacement.Open()
                try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
                $entry.Delete()
            }
        }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $dex 'classes.dex'),'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    finally { $archive.Dispose() }
    $aligned = Join-Path $buildRoot 'aligned.apk'
    Invoke-BuildTool (Join-Path $buildTools 'zipalign.exe') @('-f','-p','4',$unsigned,$aligned)
    $signing = Join-Path $androidRoot 'signing'
    New-Item -ItemType Directory -Path $signing,$releaseRoot -Force | Out-Null
    $keystore = Join-Path $signing 'ring-rush.keystore'
    $passwordFile = Join-Path $signing 'password.txt'
    if(-not (Test-Path -LiteralPath $keystore)) {
        $random = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($random) } finally { $rng.Dispose() }
        [IO.File]::WriteAllText($passwordFile,[Convert]::ToBase64String($random),[Text.Encoding]::ASCII)
        Invoke-BuildTool $keytool @('-genkeypair','-keystore',$keystore,'-storepass:file',$passwordFile,'-keypass:file',$passwordFile,'-alias','ring-rush','-keyalg','RSA','-keysize','2048','-validity','10950','-dname','CN=Ring Rush Family Game, OU=Personal, O=Ring Rush, C=AU','-noprompt')
    }
    $fileName = if($DebugWebView) {'Sonic-Ring-Rush-Android-test.apk'} else {'Sonic-Ring-Rush-Android.apk'}
    $apk = Join-Path $releaseRoot $fileName
    $signer = Join-Path $buildTools 'lib/apksigner.jar'
    Invoke-BuildTool $java @('-jar',$signer,'sign','--ks',$keystore,'--ks-key-alias','ring-rush','--ks-pass',('file:'+$passwordFile),'--out',$apk,$aligned)
    Invoke-BuildTool $java @('-jar',$signer,'verify','--verbose',$apk)
    $check = [IO.Compression.ZipFile]::OpenRead($apk)
    try {
        foreach($required in @('AndroidManifest.xml','classes.dex','assets/www/index.html')) {
            if(-not $check.GetEntry($required)) { throw "APK is missing $required" }
        }
        if(@($check.Entries | Where-Object {$_.FullName.Contains('\')}).Count) { throw 'APK contains invalid asset path separators.' }
    } finally { $check.Dispose() }
    Get-Item -LiteralPath $apk | Select-Object FullName,Length
    Get-FileHash -LiteralPath $apk -Algorithm SHA256 | Select-Object Hash
} finally { Pop-Location }
