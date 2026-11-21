import { prisma } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { assertValid } from '../utils/validate.js';
import { parseId } from '../utils/params.js';

const reviewInclude = {
  client: { select: { id: true, name: true } },
  consultation: { select: { id: true, topic: true, status: true } },
};

// Перераховує середній рейтинг профілю юриста за всіма відгуками
async function recalcLawyerRating(lawyerId) {
  const agg = await prisma.review.aggregate({
    where: { lawyerId },
    _avg: { rating: true },
  });
  await prisma.lawyerProfile.update({
    where: { userId: lawyerId },
    data: { rating: agg._avg.rating },
  });
}

export async function getReviews(req, res) {
  const { lawyerId, clientId, minRating } = req.query;
  const where = {};
  if (lawyerId) where.lawyerId = parseId(lawyerId, 'ідентифікатор юриста');
  if (clientId) where.clientId = parseId(clientId, 'ідентифікатор клієнта');
  if (minRating) where.rating = { gte: parseId(minRating, 'мінімальний рейтинг') };

  const reviews = await prisma.review.findMany({
    where,
    include: reviewInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: reviews });
}

export async function getReviewsByLawyer(req, res) {
  const lawyerUserId = parseId(req.params.id, 'ідентифікатор користувача-юриста');
  const profile = await prisma.lawyerProfile.findUnique({ where: { userId: lawyerUserId } });
  if (!profile) throw new AppError(404, 'Профіль юриста не знайдено');

  const reviews = await prisma.review.findMany({
    where: { lawyerId: lawyerUserId },
    include: reviewInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: reviews });
}

export async function getReviewById(req, res) {
  const id = parseId(req.params.id, 'ідентифікатор відгуку');
  const review = await prisma.review.findUnique({ where: { id }, include: reviewInclude });
  if (!review) throw new AppError(404, 'Відгук не знайдено');
  res.json({ data: review });
}

export async function createReview(req, res) {
  assertValid(req.body, {
    consultationId: ['required', 'positiveInt'],
    rating: ['required', 'rating'],
    text: ['string', ['max', 1000]],
  });
  const { consultationId, rating, text } = req.body;

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: { review: true },
  });
  if (!consultation) throw new AppError(404, 'Консультацію не знайдено');
  if (consultation.review) throw new AppError(409, 'Відгук для цієї консультації вже існує');
  if (consultation.status !== 'COMPLETED') {
    throw new AppError(400, 'Відгук можна залишити лише після завершення консультації');
  }

  const review = await prisma.review.create({
    data: {
      consultationId,
      clientId: consultation.clientId,
      lawyerId: consultation.lawyerId,
      rating,
      text,
    },
    include: reviewInclude,
  });
  await recalcLawyerRating(consultation.lawyerId);

  res.status(201).json({ data: review });
}

export async function updateReview(req, res) {
  const id = parseId(req.params.id, 'ідентифікатор відгуку');
  assertValid(req.body, {
    rating: ['rating'],
    text: ['string', ['max', 1000]],
  });
  const { rating, text } = req.body ?? {};
  if (rating === undefined && text === undefined) {
    throw new AppError(400, 'Не передано жодного поля для оновлення');
  }
  const data = {};
  if (rating !== undefined) data.rating = rating;
  if (text !== undefined) data.text = text;

  const review = await prisma.review.update({ where: { id }, data, include: reviewInclude });
  await recalcLawyerRating(review.lawyerId);
  res.json({ data: review });
}

export async function deleteReview(req, res) {
  const id = parseId(req.params.id, 'ідентифікатор відгуку');
  const review = await prisma.review.delete({ where: { id } });
  await recalcLawyerRating(review.lawyerId);
  res.status(204).end();
}
