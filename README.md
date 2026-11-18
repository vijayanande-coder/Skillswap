# 🎓 SkillSwap - Student-Powered Skill Marketplace

SkillSwap is a genuine, user-driven web marketplace built specifically for university and college students to:
1. **Learn & Barter**: Free skill exchange without money (e.g. teach Python to learn Spanish).
2. **Publish Freelance Services**: Offer design, coding, or writing gigs to student clients in Indian Rupees (₹).
3. **1-on-1 Peer Tutoring**: Book live lessons with university peers in Calculus, CS, Physics, etc. in ₹/hr.

> 🔒 **Authentic Platform Guarantee:**
> - Zero fabricated student accounts, fake reviews, or fake earnings.
> - Starts completely clean with authentic empty states.
> - All profiles, services, barter proposals, and bookings are created directly by real registered students and stored in MongoDB.

---

## 🛠️ Tech Stack

- **Frontend:** Semantic HTML5, Custom Responsive CSS (Navy & Royal Blue design system), Vanilla JavaScript (ES6+).
- **Backend:** Node.js, Express.js.
- **Database:** MongoDB Atlas / Mongoose (with automated fallback for local preview).
- **Security:** Bcryptjs password hashing, JSONWebToken (JWT) route protection.
- **Currency:** Indian Rupee (₹).

---

## 📁 Project Structure

```text
SkillSwap/
│
├── server.js                 # Main Express backend server & route mount
├── package.json              # Project dependencies and npm scripts
├── .env                      # Local environment configuration
├── .env.example              # Environment configuration template
├── .gitignore                # Files ignored by git (node_modules, .env)
│
├── src/                      # Backend source directory
│   ├── config/
│   │   └── db.js             # MongoDB Atlas connection handler
│   ├── models/
│   │   ├── User.js           # Student schema (name, college, major, hashed password, skills)
│   │   ├── Service.js        # Service schema (freelance, barter, lessons in ₹)
│   │   └── Booking.js        # Bookings & barter exchange agreements
│   ├── middleware/
│   │   └── authMiddleware.js # JWT verification & route protection
│   ├── controllers/
│   │   ├── authController.js    # Register, login, profile view & update
│   │   ├── serviceController.js # Marketplace CRUD (tied to real students)
│   │   └── bookingController.js # Hiring & barter requests management
│   ├── routes/
│   │   ├── authRoutes.js     # /api/auth (register, login, me, profile, students)
│   │   ├── serviceRoutes.js  # /api/services (marketplace & categories)
│   │   └── bookingRoutes.js  # /api/bookings (requests & orders)
│   └── data/
│       └── seedData.js       # Category taxonomies (No fake users)
│
└── public/                   # Frontend client directory
    ├── index.html            # Public homepage & authenticated dashboard views
    ├── css/
    │   └── styles.css        # Responsive stylesheet & design system
    └── js/
        └── main.js           # Client-side API fetching, JWT state & modals
```

---

## 🚀 How to Run the Application

### 1. Start the Server
Open your terminal in `d:\Skillswap` and run:

```bash
npm start
```

Or for development mode with automatic reload:

```bash
npm run dev
```

> **Windows Note:** If PowerShell shows a script execution error, run `npm.cmd start` or `node server.js`.

### 2. Open in Your Browser
Visit: **[http://localhost:5000](http://localhost:5000)**

---

## 🧪 How to Test the Entire Workflow

### Step 1: Verify Initial Empty State (Before Login)
- Open **http://localhost:5000**.
- You will see the public homepage explaining the 3 pillars and features.
- Notice the marketplace section says:
  > *"Be the first to publish your service."*
- Notice the student directory section says:
  > *"No students have joined yet."*
- All platform counters accurately display `0` (Zero fake metrics).

### Step 2: Register a Real Student Account
- Click **Join as Student** in the navigation bar.
- Enter your details:
  - Full Name: `Rohan Verma`
  - University / College: `IIT Delhi`
  - Major: `Computer Science`
  - Email: `rohan@iitd.ac.in`
  - Password: `password123` (min 6 characters)
- Click **Create Student Profile**.
- Notice your name and university pill instantly appear in the navigation bar with an avatar circle!

### Step 3: Edit Your Profile
- Click on your name pill in the top navigation bar.
- Add your bio (e.g. *"Passionate about full-stack web development and open source."*).
- Add skills you offer: `React, Node.js, Python, Git`.
- Add skills you want: `German, UI/UX Design`.
- Click **Save Profile**. Your card is now visible in the **Registered Students** directory!

### Step 4: Publish a Service (Free Barter or Paid Freelance in ₹)
- Click **Post a Skill** in the navigation bar.
- Fill in:
  - Service Title: `Full-Stack Web Dev Mentoring`
  - Category: `Web & Programming`
  - Listing Type: Choose `🔄 Free Skill Exchange (Barter)` or `💼 Paid Freelance Gig`
  - If Freelance / Lesson: Set your price in **Indian Rupees (₹)** (e.g., `₹500`).
  - If Barter: Type what skill you want in return (e.g., `Conversational German practice`).
  - Description & Delivery time.
- Click **Publish Service**.
- The service immediately appears live in the marketplace with your real name and college!

### Step 5: Test Booking & Student Dashboard
- To simulate student-to-student interaction, either open an Incognito browser window or logout and register a 2nd student (e.g., `Ananya Iyer` from `BITS Pilani`).
- Click **Details** on the service published in Step 4.
- Click **Propose Free Skill Exchange** or **Hire Student (₹)**.
- Log back in as the first student and click **Dashboard** in the navbar:
  - View incoming requests in the **Received Requests** tab.
  - Click **Accept** or **Mark Completed**.
  - See completed services update your simulated earnings in **₹**!

---

## 🗄️ Database Setup (MongoDB Atlas)

By default, the server runs in a resilient fallback mode so you can test immediately without any database setup.

To connect your persistent **MongoDB Atlas** cluster:
1. Open `.env`.
2. Set your Atlas connection string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/skillswap?retryWrites=true&w=majority
   ```
3. Restart the server with `npm start`. All users and listings will persist permanently in the cloud!
