(() => {
  'use strict';
  const DB_NAME='reveal-game-v20';
  const DB_VERSION=1;
  const STORE='games';
  const ACTIVE_KEY='active-game';

  const openDB=()=>new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('เปิดพื้นที่บันทึกเกมไม่สำเร็จ'));
  });

  const withStore=async(mode,fn)=>{
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      const store=tx.objectStore(STORE);
      let result;
      try { result=fn(store); } catch (e) { db.close(); reject(e); return; }
      tx.oncomplete=()=>{db.close();resolve(result)};
      tx.onerror=()=>{const e=tx.error||new Error('บันทึกข้อมูลไม่สำเร็จ');db.close();reject(e)};
      tx.onabort=()=>{const e=tx.error||new Error('การบันทึกถูกยกเลิก');db.close();reject(e)};
    });
  };

  const requestValue=req=>new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('อ่านข้อมูลไม่สำเร็จ'));
  });

  window.RevealGameStore={
    async getActive(){
      const db=await openDB();
      try{
        const tx=db.transaction(STORE,'readonly');
        return await requestValue(tx.objectStore(STORE).get(ACTIVE_KEY));
      } finally { db.close(); }
    },
    async saveActive(game){
      await withStore('readwrite',store=>store.put(game,ACTIVE_KEY));
      return game;
    },
    async clearActive(){ await withStore('readwrite',store=>store.delete(ACTIVE_KEY)); },
    key:ACTIVE_KEY
  };
})();
