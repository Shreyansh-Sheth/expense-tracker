import {
  Box,
  Button,
  Container,
  Divider,
  Group,
  Select,
  Title,
} from "@mantine/core";
import { Link, redirect, useSearchParams } from "@remix-run/react";
import { LineChart } from "@mantine/charts";
import { getAuth } from "@clerk/remix/ssr.server";
import { useLoaderData } from "@remix-run/react";
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { db } from "~/utils/db";

// Add this helper function before the loader
function groupByDate(items: Array<{ date: Date; amount: number }>) {
  const grouped = items.reduce((acc: Record<string, number>, item) => {
    const dateStr = new Date(item.date).toISOString().split('T')[0];
    acc[dateStr] = (acc[dateStr] || 0) + item.amount;
    return acc;
  }, {});

  // Convert to array format required by LineChart
  return Object.entries(grouped).map(([date, amount]) => ({
    date,
    amount
  }));
}

// Add loader function to fetch data
export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const searchParams = new URL(args.request.url).searchParams;
  
  // Get filters for both expense and income
  const expensePeriod = searchParams.get("expensePeriod") || "all";
  const incomePeriod = searchParams.get("incomePeriod") || "all";
  const expenseAccountId = searchParams.get("expenseAccount");
  const incomeAccountId = searchParams.get("incomeAccount");

  // Define date filters based on period
  let dateFilter = {};
  const now = new Date();
  
  switch (expensePeriod) {
    case "today":
      dateFilter = { gte: new Date(now.setHours(0, 0, 0, 0)) };
      break;
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      dateFilter = {
        gte: new Date(yesterday.setHours(0, 0, 0, 0)),
        lt: new Date(yesterday.setHours(23, 59, 59, 999))
      };
      break;
    case "last-7-days":
      dateFilter = {
        gte: new Date(now.setDate(now.getDate() - 7))
      };
      break;
    // ... add other cases as needed
  }

  // Fetch all accounts for the user
  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true, name: true }
  });

  // Fetch expenses and incomes separately
  const expenses = await db.expense.findMany({
    where: {
      userId,
      date: dateFilter,
      ...(expenseAccountId ? { accountId: expenseAccountId } : {})
    },
    orderBy: { date: 'asc' }
  });

  const incomes = await db.income.findMany({
    where: {
      userId,
      date: dateFilter,
      ...(incomeAccountId ? { accountId: incomeAccountId } : {})
    },
    orderBy: { date: 'asc' }
  });

  const expenseChartData = groupByDate(expenses);
  const incomeChartData = groupByDate(incomes);

  return json({ expenseChartData, incomeChartData, accounts });
}

export default function Home() {
  const { expenseChartData, incomeChartData, accounts } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <Container mt="md">
      <Group justify="space-between">
        <Title order={3}>Home</Title>
      </Group>
      <Divider my={10} />

      {/* Expenses Section */}
      <Box mb={40}>
        <Title order={4}>Expenses</Title>
        <Group justify="end">
          <Select
            name="expenseAccount"
            placeholder="All accounts"
            value={searchParams.get('expenseAccount') || ''}
            data={[
              { value: '', label: 'All accounts' },
              ...accounts.map(acc => ({
                value: acc.id,
                label: acc.name
              }))
            ]}
            onChange={(value) => {
              const url = new URL(window.location.href);
              if (value) {
                url.searchParams.set("expenseAccount", value);
              } else {
                url.searchParams.delete("expenseAccount");
              }
              window.location.href = url.toString();
            }}
          />
          <Select
            name="expensePeriod"
            value={searchParams.get('expensePeriod') || 'all'}
            data={[
              { value: "all", label: "All" },
              { value: "last-7-days", label: "Last 7 days" },
              { value: "last-30-days", label: "Last 30 days" },
              { value: "this-month", label: "This month" },
              { value: "last-month", label: "Last month" },
            ]}
            onChange={(value) => {
              const url = new URL(window.location.href);
              url.searchParams.set("expensePeriod", value || "all");
              window.location.href = url.toString();
            }}
          />
        </Group>
        <Box mt={20}>
          <LineChart
            h={300}
            data={expenseChartData}
            dataKey="date"
            series={[{ name: "amount", color: "red.6" }]}
            curveType="natural"
            gridAxis="none"
          />
        </Box>
      </Box>

      {/* Income Section */}
      <Box>
        <Title order={4}>Income</Title>
        <Group justify="end">
          <Select
            name="incomeAccount"
            placeholder="All accounts"
            value={searchParams.get('incomeAccount') || ''}
            data={[
              { value: '', label: 'All accounts' },
              ...accounts.map(acc => ({
                value: acc.id,
                label: acc.name
              }))
            ]}
            onChange={(value) => {
              const url = new URL(window.location.href);
              if (value) {
                url.searchParams.set("incomeAccount", value);
              } else {
                url.searchParams.delete("incomeAccount");
              }
              window.location.href = url.toString();
            }}
          />
          <Select
            name="incomePeriod"
            value={searchParams.get('incomePeriod') || 'all'}
            data={[
              { value: "all", label: "All" },
              { value: "last-7-days", label: "Last 7 days" },
              { value: "last-30-days", label: "Last 30 days" },
              { value: "this-month", label: "This month" },
              { value: "last-month", label: "Last month" },
            ]}
            onChange={(value) => {
              const url = new URL(window.location.href);
              url.searchParams.set("incomePeriod", value || "all");
              window.location.href = url.toString();
            }}
          />
        </Group>
        <Box mt={20}>
          <LineChart
            h={300}
            data={incomeChartData}
            dataKey="date"
            series={[{ name: "amount", color: "green.6" }]}
            curveType="natural"
            gridAxis="none"
          />
        </Box>
      </Box>
    </Container>
  );
}
