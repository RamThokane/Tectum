// Usage: npm run make-admin -- someone@example.com
import { connectDBForScript, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error('Usage: npm run make-admin -- <email>');
  process.exit(1);
}

await connectDBForScript();
const user = await User.findOneAndUpdate({ email }, { isAdmin: true }, { returnDocument: 'after' });
console.log(user ? `${user.name} <${user.email}> is now an admin.` : `No user found with email ${email}`);
await disconnectDB();
