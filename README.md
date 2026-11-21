# Legal Consult API

REST API серверної частини **онлайн-платформи юридичних консультацій**: клієнти знаходять юриста за сферою права, створюють запит на консультацію, спілкуються з юристом у чаті та залишають відгук після завершення.

Проєкт — лабораторні роботи 1–3 курсу веброзробки (Node.js + Express + PostgreSQL + Prisma).

## Стек

- Node.js 24 LTS, ES-модулі (`"type": "module"`)
- Express 5
- PostgreSQL 17 + Prisma 7 (`prisma-client` генератор, `prisma.config.ts`, `@prisma/adapter-pg`)
- Swagger (swagger-jsdoc + swagger-ui-express) — документація на `/api-docs`
- helmet, cors
- Тести: вбудований `node:test` + supertest (проти окремої тестової БД)

## ER-діаграма

```mermaid
erDiagram
    User ||--o{ Consultation : "як клієнт"
    User ||--o{ Consultation : "як юрист"
    User ||--o| LawyerProfile : "має профіль"
    User ||--o{ Message : "надсилає"
    User ||--o{ Review : "залишає"
    LawyerProfile }o--o{ Specialization : "має сфери права"
    Consultation ||--o{ Message : "містить чат"
    Consultation ||--o| Review : "має відгук"
```

Сутності: `User` (ролі CLIENT / LAWYER / ADMIN), `LawyerProfile`, `Specialization`, `Consultation`, `Message`, `Review`.
Зв'язки: один-до-багатьох (User → Consultation двома роліями, Consultation → Message/Review) і багато-до-багатьох (LawyerProfile ↔ Specialization).

## Встановлення та запуск

Вимоги: Node.js 24 LTS, PostgreSQL (локально або віддалено).

```bash
# клонування
git clone https://github.com/mishachernika/legal-consult-api.git
cd legal-consult-api

# залежності
npm install

# змінні середовища (файл .env не входить до репозиторію)
cp .env.example .env        # вкажіть свій DATABASE_URL
cp .env.test.example .env.test   # для тестів

# база даних: міграції + демо-дані (seed)
npm run db:migrate
npm run db:seed

# запуск
npm run dev        # із --watch, порт із .env (PORT=3000)
npm start          # без --watch
```

Сервер: `http://localhost:3000` · Swagger UI: `http://localhost:3000/api-docs` · health-check: `GET /health`

## Змінні середовища

| Змінна | Призначення | Приклад |
|---|---|---|
| `DATABASE_URL` | рядок підключення до PostgreSQL | `postgresql://user:pass@localhost:5432/legal_consult` |
| `PORT` | порт HTTP-сервера | `3000` |
| `FRONTEND_URL` | дозволений origin для CORS | `http://localhost:5173` |

## API

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/health` | стан сервера |
| GET/POST | `/api/users` | список / створення користувача (`?role=`) |
| GET/PUT/DELETE | `/api/users/:id` | картка / оновлення / видалення |
| GET/POST | `/api/lawyers` | список із фільтрами (`?specializationId=&search=&minPrice=&maxPrice=&sortBy=&order=`) / створення профілю |
| GET/PUT/DELETE | `/api/lawyers/:id` | профіль юриста з відгуками / оновлення / видалення |
| GET | `/api/lawyers/:id/reviews` | відгуки про юриста (id користувача) |
| GET/POST | `/api/specializations` | довідник сфер права |
| GET/PUT/DELETE | `/api/specializations/:id` | картка сфери зі списком юристів |
| GET/POST | `/api/consultations` | список із фільтрами (`?clientId=&lawyerId=&status=`) / новий запит (ціна за замовчуванням = ставка юриста) |
| GET/PUT/DELETE | `/api/consultations/:id` | картка з чатом і відгуком / зміна статусу та полів / видалення |
| GET/POST | `/api/consultations/:id/messages` | чат консультації (лише учасники можуть писати) |
| GET/POST | `/api/reviews` | список відгуків (`?lawyerId=&clientId=&minRating=`) / відгук на завершену консультацію |
| GET/PUT/DELETE | `/api/reviews/:id` | картка / оновлення / видалення відгуку |

Усі помилки повертаються у форматі `{ "error": "...", "details": {...} }` з кодами 400 (валідація), 403, 404, 409, 500.
Повна документація з прикладами — у Swagger UI на `/api-docs`.

## Тестування

```bash
npm test                 # міграція тестової БД + 28 інтеграційних тестів (node:test + supertest)
node scripts/smoke.mjs   # smoke-тест проти запущеного сервера (16 перевірок)
```

CI: `.github/workflows/tests.yml` — на кожен push/PR жене тести на Node 24 із PostgreSQL 17 у сервісному контейнері.

## Структура проєкту

```
├── prisma/
│   ├── schema.prisma        # моделі домену
│   ├── migrations/          # історія міграцій
│   └── seed.js              # демо-дані
├── src/
│   ├── app.js               # збирання застосунку (без listen — для тестів)
│   ├── server.js            # запуск сервера
│   ├── db.js                # єдиний екземпляр PrismaClient
│   ├── config/swagger.js    # конфігурація OpenAPI
│   ├── controllers/         # бізнес-логіка CRUD
│   ├── routes/              # маршрути + JSDoc для Swagger
│   ├── middleware/          # централізована обробка помилок
│   └── utils/               # валідація, AppError, parseId
├── tests/api.test.js        # інтеграційні тести API
├── scripts/smoke.mjs        # smoke-тест
├── reports/                 # звіти лабораторних робіт
└── .github/workflows/       # CI
```

## Автор

Чернік Михайло Богданович, група ІПЗ-41, ВФК НУХТ (викладач — Юхта О.А.)
