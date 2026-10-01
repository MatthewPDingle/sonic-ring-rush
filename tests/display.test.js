import test from 'node:test';
import assert from 'node:assert/strict';
import { displayProfile } from '../src/display.js';

test('folded portrait, unfolded window and rotated cover screen choose usable layouts', () => {
  assert.equal(displayProfile(344,900,3,true).layout,'phone');
  assert.equal(displayProfile(800,900,3,true).layout,'expanded');
  assert.equal(displayProfile(900,344,3,true).layout,'phone-landscape');
  assert.equal(displayProfile(900,800,3,true).layout,'expanded');
  assert.equal(displayProfile(320,700,3,true).layout,'phone');
});
test('Android uses native device resolution on cover and unfolded screens', () => {
  for(const [w,h,dpr] of [[800,900,3],[1200,1600,3],[900,344,3],[2400,1800,2],[344,900,1]]){
    const {pixelRatio}=displayProfile(w,h,dpr,true);
    assert.equal(pixelRatio,dpr);
  }
  assert.equal(displayProfile(344,900,1,true).pixelRatio,1);
  assert.equal(displayProfile(800,600,2,false).pixelRatio,1.5);
  assert.equal(displayProfile(3840,2160,2,false).pixelRatio,1.5);
});
