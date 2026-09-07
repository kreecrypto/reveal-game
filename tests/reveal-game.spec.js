import { test, expect } from '@playwright/test';

const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');

async function uploadAndApplyFirstImage(page){
  await page.locator('[data-field="file"]').first().setInputFiles({name:'test.png',mimeType:'image/png',buffer:tinyPng});
  await expect(page.locator('[data-ui="image-editor-modal"]')).not.toHaveClass(/is-hidden/);
  await expect(page.getByRole('heading',{name:'จัดรูปให้เป๊ะก่อน'})).toBeVisible();
  await page.getByRole('button',{name:'ใช้รูปนี้'}).click();
  await expect(page.locator('[data-ui="image-editor-modal"]')).toHaveClass(/is-hidden/);
  await expect(page.locator('[data-check="image"]').first()).toContainText('✓');
}

async function fillFirstQuestion(page,{answer='แมวเทสต์'}={}){
  await uploadAndApplyFirstImage(page);
  await page.locator('[data-field="answer"]').first().fill(answer);
  await expect(page.locator('[data-check="answer"]').first()).toContainText('✓');
}

test('setup saves, reloads, and plays the custom game',async({page})=>{
  await page.goto('/setup.html');
  await page.locator('#game-title').fill('เกมทดสอบ');
  await fillFirstQuestion(page,{answer:'แมวเทสต์'});

  await page.getByRole('button',{name:'เก็บไว้ก่อน'}).click();
  await expect(page.locator('[data-ui="status"]')).toContainText('เก็บแล้ว');

  await page.reload();
  await expect(page.locator('#game-title')).toHaveValue('เกมทดสอบ');
  await expect(page.locator('[data-field="answer"]').first()).toHaveValue('แมวเทสต์');

  await page.getByRole('button',{name:'ลุยเลย'}).click();
  await expect(page).toHaveURL(/\?custom=1$/);
  await expect(page.locator('[data-screen="game"]')).toHaveClass(/is-active/);

  const firstTile=page.locator('[data-tile="0"]');
  await firstTile.click();
  await expect(firstTile).toHaveClass(/is-open/);

  await page.getByRole('button',{name:'ไม่ไหวละ ดูเฉลย'}).click();
  await expect(page.locator('[data-ui="answer"]')).toHaveText('แมวเทสต์');
  await expect(page.getByRole('button',{name:/ดูตอนจบ|ไปข้อต่อไป/})).toBeVisible();
});

test('image editor supports zoom, crop apply, save, and re-edit',async({page})=>{
  await page.goto('/setup.html');
  await page.locator('[data-field="file"]').first().setInputFiles({name:'crop-test.png',mimeType:'image/png',buffer:tinyPng});
  await expect(page.locator('[data-ui="image-editor-modal"]')).not.toHaveClass(/is-hidden/);

  const zoom=page.locator('[data-ui="image-zoom"]');
  await zoom.evaluate(el=>{el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await expect(page.locator('[data-ui="zoom-value"]')).toHaveText('1.50×');

  const canvas=page.locator('[data-ui="image-editor-canvas"]');
  const box=await canvas.boundingBox();
  if(box){
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+24,box.y+box.height/2+16,{steps:3});
    await page.mouse.up();
  }

  await page.getByRole('button',{name:'ใช้รูปนี้'}).click();
  await expect(page.locator('[data-check="image"]').first()).toContainText('✓');
  await page.locator('[data-field="answer"]').first().fill('แมว');
  await page.getByRole('button',{name:'เก็บไว้ก่อน'}).click();
  await expect(page.locator('[data-ui="status"]')).toContainText('เก็บแล้ว');

  await page.reload();
  await page.getByRole('button',{name:'แก้ภาพ'}).first().click();
  await expect(page.locator('[data-ui="image-editor-modal"]')).not.toHaveClass(/is-hidden/);
  await expect(page.locator('[data-ui="zoom-value"]')).toHaveText('1.50×');
  await page.getByRole('button',{name:'ไม่เอาละ'}).click();
});

test('dirty setup asks before leaving and can discard safely',async({page})=>{
  await page.goto('/setup.html');
  await page.locator('#game-title').fill('ยังไม่เซฟ');

  await page.getByLabel('กลับหน้าเกม').click();
  await expect(page.locator('[data-ui="leave-modal"]')).not.toHaveClass(/is-hidden/);
  await expect(page.getByRole('heading',{name:'ยังไม่ได้เก็บนะ จะไปจริงดิ?'})).toBeVisible();

  await page.getByRole('button',{name:'อยู่ต่อ'}).click();
  await expect(page).toHaveURL(/setup\.html/);

  await page.getByLabel('กลับหน้าเกม').click();
  await page.getByRole('button',{name:'ไปเลย ไม่เก็บ'}).click();
  await expect(page).toHaveURL(/\/$/);
});

test('removed question can be undone before save',async({page})=>{
  await page.goto('/setup.html');
  await page.getByRole('button',{name:'+ เพิ่มอีกข้อ'}).click();
  await expect(page.locator('[data-item]')).toHaveCount(2);

  await page.locator('[data-action="remove-item"]').nth(1).click();
  await expect(page.locator('[data-item]')).toHaveCount(1);
  await page.getByRole('button',{name:'เอาคืน'}).click();
  await expect(page.locator('[data-item]')).toHaveCount(2);
});
