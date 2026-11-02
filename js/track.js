import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function recordVisit(user) {
  const key = "jee-visit-" + user.uid;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch (error) {}
  try {
    const ref = doc(db, "buyers", user.uid);
    const existing = await getDoc(ref);
    const data = {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photo: user.photoURL || "",
      lastLogin: serverTimestamp(),
      loginCount: increment(1),
    };
    if (!existing.exists()) data.firstLogin = serverTimestamp();
    await setDoc(ref, data, { merge: true });
    await addDoc(collection(db, "logins"), {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      at: serverTimestamp(),
    });
    try {
      sessionStorage.setItem(key, "1");
    } catch (error) {}
  } catch (error) {
    console.error("Gagal mencatat login:", error);
  }
}
