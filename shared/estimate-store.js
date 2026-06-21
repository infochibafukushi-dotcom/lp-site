(function(global){
  const COLLECTION = "stores";
  const DOC_PATH = "estimateSimulator/config";

  let firebaseApp = null;
  let firestoreDb = null;
  let authReady = false;

  function getConfig(){
    return global.FirebaseConfig || {};
  }

  function isEnabled(){
    const cfg = getConfig();
    return cfg.enabled === true && !!cfg.projectId && !!cfg.apiKey;
  }

  function getStoreId(override){
    const cfg = getConfig();
    return String(override || cfg.storeId || "default").trim() || "default";
  }

  function ensureFirebase(){
    if(!isEnabled()){
      throw new Error("Firebase が未設定です。shared/firebase-config.js を設定してください。");
    }
    if(typeof firebase === "undefined"){
      throw new Error("Firebase SDK が読み込まれていません。");
    }
    if(!firebaseApp){
      const cfg = getConfig();
      if(firebase.apps && firebase.apps.length){
        firebaseApp = firebase.app();
      }else{
        firebaseApp = firebase.initializeApp({
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain,
          projectId: cfg.projectId,
          storageBucket: cfg.storageBucket,
          messagingSenderId: cfg.messagingSenderId,
          appId: cfg.appId
        });
      }
      firestoreDb = firebase.firestore();
    }
    return { app: firebaseApp, db: firestoreDb };
  }

  function docRef(storeId){
    const { db } = ensureFirebase();
    const parts = DOC_PATH.split("/");
    return db.collection(COLLECTION).doc(getStoreId(storeId))
      .collection(parts[0]).doc(parts[1]);
  }

  async function loadEstimateConfig(storeId, options){
    if(!isEnabled()){
      throw new Error("Firebase が未設定です。");
    }
    const opts = options || {};
    const snap = await docRef(storeId).get();
    if(!snap.exists){
      throw new Error("料金シミュレーター設定が Firestore にありません。管理画面から初期データを投入してください。");
    }
    const data = snap.data();
    if(opts.requireEnabled !== false && data.enabled === false){
      throw new Error("料金シミュレーターは現在停止中です。");
    }
    return data;
  }

  async function copyEstimateConfig(fromStoreId, toStoreId){
    const source = await loadEstimateConfig(fromStoreId, { requireEnabled: false });
    const copy = Object.assign({}, source, {
      storeId: getStoreId(toStoreId),
      updatedAt: new Date().toISOString()
    });
    return saveEstimateConfig(copy, toStoreId);
  }

  async function issueEstimateNumber(storeId){
    if(typeof global.EstimateNumber === "undefined"){
      throw new Error("EstimateNumber モジュールが読み込まれていません。");
    }
    const { db } = ensureFirebase();
    const sid = getStoreId(storeId);
    const dateKey = global.EstimateNumber.formatDateKey(new Date());
    const counterRef = db.collection(COLLECTION).doc(sid).collection("estimateCounters").doc(dateKey);

    return db.runTransaction(async function(transaction){
      const snap = await transaction.get(counterRef);
      let count = 1;
      if(snap.exists){
        count = (Number(snap.data().count) || 0) + 1;
      }
      transaction.set(counterRef, {
        date: dateKey,
        count: count,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return global.EstimateNumber.formatEstimateNumber(dateKey, count);
    });
  }

  async function saveEstimateHistory(storeId, record){
    const { db } = ensureFirebase();
    const sid = getStoreId(storeId);
    const docId = String(record.estimateNumber || Date.now()).replace(/[^\w-]/g, "_");
    await db.collection(COLLECTION).doc(sid).collection("estimateHistory").doc(docId).set(record);
  }

  async function createEstimateRecord(storeId, simulatorConfig, payload){
    if(typeof global.EstimateNumber === "undefined"){
      throw new Error("EstimateNumber モジュールが読み込まれていません。");
    }
    const saveHistory = simulatorConfig?.historySettings?.saveHistory === true;
    const createdAt = new Date().toISOString();
    let estimateNumber;

    if(saveHistory){
      estimateNumber = await issueEstimateNumber(storeId);
      const record = global.EstimateNumber.buildHistoryRecord(Object.assign({}, payload, {
        estimateNumber: estimateNumber,
        storeId: getStoreId(storeId),
        createdAt: createdAt
      }));
      await saveEstimateHistory(storeId, record);
    }else{
      estimateNumber = global.EstimateNumber.issueLocalEstimateNumber();
    }

    return {
      estimateNumber: estimateNumber,
      createdAt: createdAt,
      savedToHistory: saveHistory
    };
  }

  async function saveEstimateConfig(config, storeId){
    if(!isEnabled()){
      throw new Error("Firebase が未設定です。");
    }
    const user = firebase.auth().currentUser;
    if(!user){
      throw new Error("Firestore への保存には管理画面でのログインが必要です。");
    }
    const payload = Object.assign({}, config, {
      storeId: getStoreId(storeId),
      updatedAt: new Date().toISOString()
    });
    await docRef(storeId).set(payload, { merge: false });
    return payload;
  }

  async function signInAdmin(email, password){
    ensureFirebase();
    await firebase.auth().signInWithEmailAndPassword(email, password);
    authReady = true;
    return firebase.auth().currentUser;
  }

  async function signOutAdmin(){
    if(typeof firebase !== "undefined" && firebase.auth){
      await firebase.auth().signOut();
    }
    authReady = false;
  }

  function onAuthStateChanged(callback){
    ensureFirebase();
    return firebase.auth().onAuthStateChanged(callback);
  }

  function getCurrentUser(){
    if(typeof firebase === "undefined" || !firebase.auth) return null;
    return firebase.auth().currentUser;
  }

  global.EstimateStore = {
    isEnabled: isEnabled,
    getStoreId: getStoreId,
    loadEstimateConfig: loadEstimateConfig,
    saveEstimateConfig: saveEstimateConfig,
    copyEstimateConfig: copyEstimateConfig,
    issueEstimateNumber: issueEstimateNumber,
    saveEstimateHistory: saveEstimateHistory,
    createEstimateRecord: createEstimateRecord,
    signInAdmin: signInAdmin,
    signOutAdmin: signOutAdmin,
    onAuthStateChanged: onAuthStateChanged,
    getCurrentUser: getCurrentUser
  };
})(typeof window !== "undefined" ? window : globalThis);
