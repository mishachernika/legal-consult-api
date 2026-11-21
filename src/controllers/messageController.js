import { prisma } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { assertValid } from '../utils/validate.js';
import { parseId } from '../utils/params.js';

export async function listMessages(req, res) {
  const consultationId = parseId(req.params.id, 'ідентифікатор консультації');
  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) throw new AppError(404, 'Консультацію не знайдено');

  const messages = await prisma.message.findMany({
    where: { consultationId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  res.json({ data: messages });
}

export async function createMessage(req, res) {
  const consultationId = parseId(req.params.id, 'ідентифікатор консультації');
  assertValid(req.body, {
    senderId: ['required', 'positiveInt'],
    text: ['required', 'string', ['min', 1], ['max', 2000]],
  });
  const { senderId, text } = req.body;

  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) throw new AppError(404, 'Консультацію не знайдено');

  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender) throw new AppError(404, 'Відправника не знайдено');

  // писати в чат можуть лише учасники консультації: клієнт або призначений юрист
  if (sender.id !== consultation.clientId && sender.id !== consultation.lawyerId) {
    throw new AppError(403, 'Лише учасники консультації можуть надсилати повідомлення');
  }

  const message = await prisma.message.create({
    data: { consultationId, senderId, text },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  res.status(201).json({ data: message });
}
