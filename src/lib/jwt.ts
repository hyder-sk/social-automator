import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function generateVerificationToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'email-verification' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): { userId: string; type: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (decoded.type !== 'email-verification') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
} 