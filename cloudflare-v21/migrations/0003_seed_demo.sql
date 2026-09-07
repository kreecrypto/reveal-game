PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO games (id, title, description, difficulty, status)
VALUES ('cute-arcade-demo', 'เปิดป้ายดิ', 'เกมเปิดป้ายภาพแนว Cute Arcade', 'normal', 'published');

INSERT OR IGNORE INTO game_rounds (id, game_id, sort_order, question, answer_json, hint, grid_size, asset_key)
VALUES
  ('round-cat', 'cute-arcade-demo', 1, 'ใครทำหน้าเหมือนไม่สนใจโลก?', '["แมว","cat"]', 'ชอบกล่อง ชอบนอน ชอบเมินเรา', 3, NULL),
  ('round-dog', 'cute-arcade-demo', 2, 'ใครดีใจเหมือนเราเพิ่งกลับจากต่างดาว?', '["หมา","สุนัข","dog"]', 'หางนี่ฟ้องหมดแล้ว', 4, NULL),
  ('round-panda', 'cute-arcade-demo', 3, 'ใครใส่แว่นดำมาตั้งแต่เกิด?', '["แพนด้า","panda"]', 'ดำขาว กินไผ่ ไม่ใช่ม้าลาย', 4, NULL);
