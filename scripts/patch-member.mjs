/**
 * One-time patch: updates team_members/cKwDuYUiPno9N1hRlFfv to active status.
 * Run: node scripts/patch-member.mjs aliza.solomon@uptodatewebdesign.com YOUR_PASSWORD
 */
import { initializeApp }     from 'firebase/app'
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyDlM_3fxIBXM8G0tyUY2RqHYyK0xfeN44A',
  authDomain:        'production-project-tracker.firebaseapp.com',
  projectId:         'production-project-tracker',
  storageBucket:     'production-project-tracker.firebasestorage.app',
  messagingSenderId: '230828491407',
  appId:             '1:230828491407:web:538682288ba003ff9aa6fa',
}

const TARGET_DOC = 'cKwDuYUiPno9N1hRlFfv'

const [,, email, password] = process.argv
if (!email || !password) {
  console.error('Usage: node scripts/patch-member.mjs <email> <password>')
  process.exit(1)
}

const app  = initializeApp(firebaseConfig)
const auth = initializeAuth(app, { persistence: inMemoryPersistence })
const db   = getFirestore(app)

console.log(`Signing in as ${email}…`)
await signInWithEmailAndPassword(auth, email, password)
console.log('Signed in.\n')

const ref    = doc(db, 'team_members', TARGET_DOC)
const before = await getDoc(ref)

if (!before.exists()) {
  console.error(`team_members/${TARGET_DOC} not found — nothing to patch.`)
  await signOut(auth)
  process.exit(1)
}

console.log('Current values:')
const bd = before.data()
console.log('  status:     ', bd.status)
console.log('  active:     ', bd.active)
console.log('  inviteCode: ', bd.inviteCode)
console.log()

await updateDoc(ref, {
  status:      'active',
  active:      true,
  inviteCode:  null,
  acceptedAt:  serverTimestamp(),
})

const after = await getDoc(ref)
const ad    = after.data()
console.log('Patched values:')
console.log('  status:     ', ad.status)
console.log('  active:     ', ad.active)
console.log('  inviteCode: ', ad.inviteCode)
console.log('  acceptedAt: ', ad.acceptedAt?.toDate?.() || ad.acceptedAt)

if (ad.status === 'active' && ad.active === true && ad.inviteCode === null) {
  console.log('\n✓ Patch successful. Member now shows as Active in the Members tab.')
} else {
  console.error('\n✗ Unexpected values after patch. Check Firestore directly.')
}

await signOut(auth)
process.exit(0)
