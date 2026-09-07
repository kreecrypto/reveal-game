import { test, expect } from '@playwright/test';

const LIVE=process.env.SUPABASE_LIVE_E2E==='1';
const SUPABASE_URL='https://xhqrfovpsoccocakjxfk.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_EbO5kNUl9EaS7s2VOXTnfA_-1XcOW_q';
const BUCKET='reveal-game-assets';
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');

test.skip(!LIVE,'set SUPABASE_LIVE_E2E=1 to run against real Supabase');

test('real browser publish, public play, edit update, and storage cleanup',async({browser,request})=>{
  const creator=await browser.newContext();
  const page=await creator.newPage();
  let slug='';
  let editToken='';
  let finalAsset='';

  try{
    await page.goto('/setup.html');
    await expect(page.locator('[data-ui="cloud-status"]')).toContainText('Share พร้อม',{timeout:15000});

    const title=`Live E2E ${Date.now()}`;
    await page.locator('#game-title').fill(title);
    await page.locator('[data-field="file"]').first().setInputFiles({name:'live.png',mimeType:'image/png',buffer:tinyPng});
    await expect(page.locator('[data-ui="image-editor-modal"]')).not.toHaveClass(/is-hidden/);
    await page.getByRole('button',{name:'ใช้รูปนี้'}).click();
    await page.locator('[data-field="answer"]').first().fill('แมว Live');
    await page.getByRole('button',{name:'เผยแพร่เกม'}).click();

    await expect(page.locator('[data-ui="share-modal"]')).not.toHaveClass(/is-hidden/,{timeout:20000});
    const shareUrl=await page.locator('[data-ui="share-link"]').inputValue();
    const editUrl=await page.locator('[data-ui="edit-link"]').inputValue();
    slug=new URL(shareUrl).pathname.split('/').filter(Boolean).at(-1)||'';
    editToken=new URL(editUrl).hash.replace(/^#token=/,'');
    expect(slug).toMatch(/^[a-z0-9]{10}$/);
    expect(editToken.length).toBeGreaterThan(20);
    console.log(`LIVE_E2E_SLUG=${slug}`);

    const player=await browser.newContext();
    const playPage=await player.newPage();
    await playPage.goto(`/?share=${encodeURIComponent(slug)}`);
    await expect(playPage.locator('[data-ui="game-title"]')).toContainText(title,{timeout:15000});
    await playPage.getByRole('button',{name:'ลุยเลย'}).click();
    await expect(playPage.locator('[data-screen="game"]')).toHaveClass(/is-active/);
    await playPage.getByRole('button',{name:'ไม่ไหวละ ดูเฉลย'}).click();
    await expect(playPage.locator('[data-ui="answer"]')).toHaveText('แมว Live');
    await player.close();

    const editor=await browser.newContext();
    const editPage=await editor.newPage();
    await editPage.goto(`/setup.html?edit=${encodeURIComponent(slug)}#token=${editToken}`);
    await expect(editPage.locator('#game-title')).toHaveValue(title,{timeout:20000});
    await expect(editPage.locator('[data-field="answer"]').first()).toHaveValue('แมว Live');
    await editPage.locator('[data-field="answer"]').first().fill('แมว Live Updated');
    await editPage.getByRole('button',{name:'เผยแพร่เกม'}).click();
    await expect(editPage.locator('[data-ui="share-modal"]')).not.toHaveClass(/is-hidden/,{timeout:20000});
    await editor.close();

    const verify=await browser.newContext();
    const verifyPage=await verify.newPage();
    await verifyPage.goto(`/?share=${encodeURIComponent(slug)}`);
    await expect(verifyPage.locator('[data-ui="game-title"]')).toContainText(title,{timeout:15000});
    await verifyPage.getByRole('button',{name:'ลุยเลย'}).click();
    await verifyPage.getByRole('button',{name:'ไม่ไหวละ ดูเฉลย'}).click();
    await expect(verifyPage.locator('[data-ui="answer"]')).toHaveText('แมว Live Updated');

    const remote=await verifyPage.evaluate(async s=>window.RevealShareApi.fetchGame(s),slug);
    finalAsset=remote.questions?.[0]?.asset||'';
    expect(finalAsset).toContain(`shared-games/${slug}/`);
    await verify.close();
  } finally {
    if(finalAsset&&editToken){
      const encoded=finalAsset.split('/').map(encodeURIComponent).join('/');
      const cleanup=await request.delete(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encoded}`,{
        headers:{apikey:PUBLISHABLE_KEY,'X-Edit-Token':editToken}
      });
      console.log(`LIVE_E2E_STORAGE_CLEANUP=${cleanup.status()}`);
    }
    await creator.close();
  }
});
