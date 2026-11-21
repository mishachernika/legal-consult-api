import { prisma } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { assertValid } from '../utils/validate.js';
import { parseId } from '../utils/params.js';

export const lawyerInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, role: true } },
  specializations: true,
};

const SORTABLE = ['rating', 'pricePerHour', 'experienceYears'];

export async function getLawyers(req, res) {
  const { specializationId, search, minPrice, maxPrice, sortBy = 'rating', order = 'desc' } = req.query;

  const where = {};
  if (specializationId) {
    where.specializations = { some: { id: parseId(specializationId, 'ідентифікатор спеціалізації') } };
  }
  if (search) {
    where.OR = [
      { bio: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.pricePerHour = {};
    if (minPrice !== undefined) where.pricePerHour.gte = Number(minPrice);
    if (maxPrice !== undefined) where.pricePerHour.lte = Number(maxPrice);
  }

  const lawyers = await prisma.lawyerProfile.findMany({
    where,
    include: lawyerInclude,
    orderBy: { [SORTABLE.includes(sortBy) ? sortBy : 'rating']: order === 'asc' ? 'asc' : 'desc' },
  });
  res.json({ data: lawyers });
}

export async function getLawyerById(req, res) {
  const id = parseId(req.params.id, 'ідентифікатор профілю юриста');
  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id },
    include: lawyerInclude,
  });
  if (!lawyer) throw new AppError(404, 'Профіль юриста не знайдено');
  const consultationsCount = await prisma.consultation.count({ where: { lawyerId: lawyer.userId } });
  const reviews = await prisma.review.findMany({
    where: { lawyerId: lawyer.userId },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  });
  res.json({ data: { ...lawyer, consultationsCount, reviews } });
}

async function assertSpecializationsExist(specializationIds) {
  const found = await prisma.specialization.findMany({
    where: { id: { in: specializationIds } },
    select: { id: true },
  });
  if (found.length !== specializationIds.length) {
    throw new AppError(400, 'Частину спеціалізацій не знайдено', { specializationIds });
  }
}

export async function createLawyer(req, res) {
  assertValid(req.body, {
    userId: ['required', 'positiveInt'],
    bio: ['string', ['max', 2000]],
    experienceYears: ['nonNegativeInt'],
    pricePerHour: ['required', 'nonNegativeNumber'],
    isVerified: ['bool'],
    specializationIds: ['arrayOfPositiveInt'],
  });
  const {
    userId,
    bio,
    experienceYears = 0,
    pricePerHour,
    isVerified = false,
    specializationIds = [],
  } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Користувача не знайдено');

  const existing = await prisma.lawyerProfile.findUnique({ where: { userId } });
  if (existing) throw new AppError(409, 'Профіль юриста для цього користувача вже існує');

  if (specializationIds.length > 0) await assertSpecializationsExist(specializationIds);

  const lawyer = await prisma.lawyerProfile.create({
    data: {
      userId,
      bio,
      experienceYears,
      pricePerHour,
      isVerified,
      specializations: { connect: specializationIds.map((id) => ({ id })) },
    },
    include: lawyerInclude,
  });
  // користувач із профілем юриста отримує роль LAWYER
  await prisma.user.update({ where: { id: userId }, data: { role: 'LAWYER' } });

  res.status(201).json({ data: lawyer });
}

export async function updateLawyer(req, res) {
  const id = parseId(req.params.id, 'ідентифікатор профілю юриста');
  assertValid(req.body, {
    bio: ['string', ['max', 2000]],
    experienceYears: ['nonNegativeInt'],
    pricePerHour: ['nonNegativeNumber'],
    isVerified: ['bool'],
    specializationIds: ['arrayOfPositiveInt'],
  });
  const { bio, experienceYears, pricePerHour, isVerified, specializationIds } = req.body ?? {};
  if (
    [bio, experienceYears, pricePerHour, isVerified, specializationIds].every((v) => v === undefined)
  ) {
    throw new AppError(400, 'Не передано жодного поля для оновлення');
  }
  if (specializationIds && specializationIds.length > 0) {
    await assertSpecializationsExist(specializationIds);
  }
  const data = {};
  if (bio !== undefined) data.bio = bio;
  if (experienceYears !== undefined) data.experienceYears = experienceYears;
  if (pricePerHour !== undefined) data.pricePerHour = pricePerHour;
  if (isVerified !== undefined) data.isVerified = isVerified;
  if (specializationIds !== undefined) {
    data.specializations = { set: specializationIds.map((sid) => ({ id: sid })) };
  }

  const lawyer = await prisma.lawyerProfile.update({ where: { id }, data, include: lawyerInclude });
  res.json({ data: lawyer });
}

export async function deleteLawyer(req, res) {
  const id = parseId(req.params.id, 'ідентифікатор профілю юриста');
  const lawyer = await prisma.lawyerProfile.delete({ where: { id } });
  // без профілю користувач знову стає клієнтом
  await prisma.user.update({ where: { id: lawyer.userId }, data: { role: 'CLIENT' } });
  res.status(204).end();
}
