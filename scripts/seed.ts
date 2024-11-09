import { PrismaClient } from "@prisma/client";
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();
const userId = "user_2oVtpZYtBXEazP1xNbe6XK1eEwA";

// Helper function to get random number between min and max
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to get random date between Oct and Nov 2024
const getRandomDate = () => {
  const start = new Date('2024-10-01');
  const end = new Date('2024-11-30');
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

async function seed() {
  // Clear existing data for this user
  await prisma.expenseTags.deleteMany({
    where: {
      expense: {
        userId
      }
    }
  });
  await prisma.expense.deleteMany({ where: { userId } });
  await prisma.income.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.tag.deleteMany({ where: { userId } });

  // Create accounts
  const accounts = await Promise.all([
    prisma.account.create({
      data: {
        userId,
        name: "Main Account",
        balance: 5000,
      }
    }),
    prisma.account.create({
      data: {
        userId,
        name: "Savings",
        balance: 10000,
      }
    }),
    prisma.account.create({
      data: {
        userId,
        name: "Investment",
        balance: 15000,
      }
    })
  ]);

  // Create tags
  const tags = await Promise.all([
    prisma.tag.create({ data: { userId, name: "Food" } }),
    prisma.tag.create({ data: { userId, name: "Transport" } }),
    prisma.tag.create({ data: { userId, name: "Entertainment" } }),
    prisma.tag.create({ data: { userId, name: "Shopping" } }),
    prisma.tag.create({ data: { userId, name: "Bills" } })
  ]);

  // Create expenses
  const expenseDescriptions = [
    "Grocery shopping",
    "Restaurant dinner",
    "Movie tickets",
    "Uber ride",
    "Phone bill",
    "Internet bill",
    "Coffee",
    "Books",
    "Clothes shopping",
    "Gas"
  ];

  for (let i = 0; i < 50; i++) {
    const title = expenseDescriptions[random(0, expenseDescriptions.length - 1)];
    // Generate contextual descriptions based on the title
    let description = "";
    switch (title) {
      case "Grocery shopping":
        description = ["Weekly groceries from Walmart", "Trader Joe's food run", "Costco bulk shopping"][random(0, 2)];
        break;
      case "Restaurant dinner":
        description = ["Dinner with friends", "Date night at Italian restaurant", "Family dinner out"][random(0, 2)];
        break;
      case "Movie tickets":
        description = ["Weekend movie with popcorn", "IMAX screening", "Movie night with friends"][random(0, 2)];
        break;
      case "Uber ride":
        description = ["Ride to airport", "Late night ride home", "Trip to downtown"][random(0, 2)];
        break;
      case "Phone bill":
        description = ["Monthly phone service", "Phone bill + data plan", "Mobile service payment"][random(0, 2)];
        break;
      case "Internet bill":
        description = ["Monthly internet service", "WiFi and cable package", "Broadband payment"][random(0, 2)];
        break;
      case "Coffee":
        description = ["Morning coffee run", "Starbucks meeting", "Afternoon pick-me-up"][random(0, 2)];
        break;
      case "Books":
        description = ["Amazon book order", "Bookstore purchases", "Digital textbooks"][random(0, 2)];
        break;
      case "Clothes shopping":
        description = ["New work clothes", "Seasonal wardrobe update", "Shopping mall haul"][random(0, 2)];
        break;
      case "Gas":
        description = ["Full tank fill-up", "Weekly gas refill", "Gas station stop"][random(0, 2)];
        break;
      default:
        description = "Miscellaneous expense";
    }

    const expense = await prisma.expense.create({
      data: {
        userId,
        title,
        amount: random(10, 500),
        description,
        date: getRandomDate(),
        accountId: accounts[random(0, accounts.length - 1)].id,
      }
    });

    // Add 1-3 random tags to each expense
    const numTags = random(1, 3);
    const selectedTags = [...tags]
      .sort(() => 0.5 - Math.random())
      .slice(0, numTags);

    await Promise.all(
      selectedTags.map(tag =>
        prisma.expenseTags.create({
          data: {
            expenseId: expense.id,
            tagId: tag.id
          }
        })
      )
    );
  }

  // Create incomes
  const incomeDescriptions = [
    "Salary",
    "Freelance work",
    "Investment returns",
    "Side project",
    "Consulting"
  ];

  for (let i = 0; i < 20; i++) {
    const title = incomeDescriptions[random(0, incomeDescriptions.length - 1)];
    // Generate contextual descriptions based on the title
    let description = "";
    switch (title) {
      case "Salary":
        description = ["Monthly salary payment", "Bi-weekly paycheck", "Quarterly bonus"][random(0, 2)];
        break;
      case "Freelance work":
        description = ["Web development project", "Design consultation", "Content writing gig"][random(0, 2)];
        break;
      case "Investment returns":
        description = ["Stock dividend payment", "ETF quarterly distribution", "Bond interest income"][random(0, 2)];
        break;
      case "Side project":
        description = ["Online course sales", "Mobile app revenue", "Subscription earnings"][random(0, 2)];
        break;
      case "Consulting":
        description = ["Technical consulting", "Business strategy session", "Workshop facilitation"][random(0, 2)];
        break;
      default:
        description = "Miscellaneous income";
    }

    await prisma.income.create({
      data: {
        userId,
        title,
        amount: random(1000, 5000),
        description,
        date: getRandomDate(),
        accountId: accounts[random(0, accounts.length - 1)].id,
      }
    });
  }

  console.log('Seed completed successfully!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
