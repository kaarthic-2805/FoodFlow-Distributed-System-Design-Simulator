import express, { Request, Response } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { prisma } from '@foodflow/database';
import { MetricsPublisher } from '@foodflow/shared';

const app = express();
const PORT = process.env.PORT || 4003;
const INSTANCE_ID = process.env.INSTANCE_ID || 'user-service-1';
const JWT_SECRET = process.env.JWT_SECRET || 'foodflow-super-secret-jwt-key';

const metrics = new MetricsPublisher('user-service', INSTANCE_ID);

app.use(cors());
app.use(express.json());

// Get User Profile
app.get('/profile/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, address: true, createdAt: true }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Demo Login Route
app.post('/login', async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid user credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, address: user.address } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Demo Accounts
app.get('/demo-accounts', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, address: true }
    });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service', instanceId: INSTANCE_ID });
});

app.listen(PORT, () => {
  console.log(`👤 [User Service - ${INSTANCE_ID}] Running on port ${PORT}`);
});
