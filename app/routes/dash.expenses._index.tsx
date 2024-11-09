import { getAuth } from "@clerk/remix/ssr.server";
import {
  ActionIcon,
  Badge,
  Box,
  Container,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Select,
  Group,
} from "@mantine/core";
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { db } from "~/utils/db";
import { format } from "date-fns-tz";
import { IconEdit } from "@tabler/icons-react";
import { Link } from "@remix-run/react";

type ExpenseEntry = {
  id: string;
  title: string;
  amount: number;
  date: string;
  tags: { id: string; name: string }[];
  account?: { id: string; name: string };
  description?: string | null;
};

export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return redirect("/dash");
  }

  const url = new URL(args.request.url);
  const accountId = url.searchParams.get("accountId");
  const period = url.searchParams.get("period") || "all";

  let dateFilter = {};
  const now = new Date();
  
  switch (period) {
    case "last-7-days":
      dateFilter = {
        gte: new Date(new Date().setDate(now.getDate() - 7))
      };
      break;
    case "last-30-days":
      dateFilter = {
        gte: new Date(new Date().setDate(now.getDate() - 30))
      };
      break;
    case "this-month":
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1)
      };
      break;
    case "last-month":
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        lt: new Date(now.getFullYear(), now.getMonth(), 1)
      };
      break;
  }

  const expenses = await db.expense.findMany({
    where: {
      userId: userId,
      ...(accountId ? { accountId } : {}),
      ...(period !== "all" ? { date: dateFilter } : {}),
    },
    include: {
      ExpenseTags: {
        include: {
          tag: true,
        },
      },
      account: true,
    },
  });

  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  return json({
    expense: expenses.map((expense) => ({
      ...expense,
      tags: expense.ExpenseTags.map((et) => ({
        id: et.tag.id,
        name: et.tag.name,
      })),
      account: expense.account ? {
        id: expense.account.id,
        name: expense.account.name,
      } : undefined
    })),
    accounts,
  });
}

const columnHelper = createColumnHelper<ExpenseEntry>();

const columns = [
  columnHelper.accessor("title", {
    id: "title",
    header: "Item name",
  }),
  columnHelper.accessor("amount", {
    id: "amount",
    header: "Amount",
    cell: (info) => `$${info.getValue().toFixed(2)}`,
  }),
  columnHelper.accessor("date", {
    id: "date",
    header: "Date",
    cell: (info) => format(new Date(info.getValue()), "do MMMM yyyy"),
  }),
  columnHelper.accessor("tags", {
    id: "tags",
    header: "Tags",
    cell: (info) => {
      if (info.getValue().length === 0) {
        return "-";
      }

      return info.getValue().map((e) => <Badge key={e.id}>{e.name}</Badge>);
    },
  }),
  columnHelper.accessor("account", {
    id: "account",
    header: "Account",
    cell: (info) => info.getValue()?.name ?? "-",
  }),
  columnHelper.accessor("description", {
    id: "description",
    header: "Description",
    cell: (info) => info.getValue() ?? "-",
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: (info) => {
      return (
        <ActionIcon 
          component={Link} 
          to={`/dash/expenses/${info.row.original.id}/edit`} 
          size="xs" 
          variant="subtle" 
          aria-label="Edit"
        >
          <IconEdit />
        </ActionIcon>
      );
    },
  }),
];

export default function Expenses() {
  const { expense, accounts } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleAccountChange = (value: string | null) => {
    if (value) {
      searchParams.set("accountId", value);
    } else {
      searchParams.delete("accountId");
    }
    setSearchParams(searchParams);
  };

  const { getHeaderGroups, getRowModel } = useReactTable({
    columns,
    data: expense,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Container size={"xl"} mt="md">
      <Group mb="md">
        <Select
          label="Filter by Account"
          placeholder="All accounts"
          clearable
          data={accounts.map((account) => ({
            value: account.id,
            label: account.name,
          }))}
          value={searchParams.get("accountId") || null}
          onChange={handleAccountChange}
        />
        <Select
          label="Period"
          value={searchParams.get('period') || 'all'}
          data={[
            { value: "all", label: "All" },
            { value: "last-7-days", label: "Last 7 days" },
            { value: "last-30-days", label: "Last 30 days" },
            { value: "this-month", label: "This month" },
            { value: "last-month", label: "Last month" },
          ]}
          onChange={(value) => {
            if (value) {
              searchParams.set("period", value);
            } else {
              searchParams.delete("period");
            }
            setSearchParams(searchParams);
          }}
        />
      </Group>

      <Table>
        <TableThead>
          <TableTr>
            {getHeaderGroups().map((headerGroup) => {
              return headerGroup.headers.map((header) => (
                <TableTh key={headerGroup.id}>
                  <Box key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </Box>
                </TableTh>
              ));
            })}
          </TableTr>
        </TableThead>
        <TableTbody>
          {getRowModel().rows.map((row) => (
            <TableTr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableTd key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableTd>
              ))}
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </Container>
  );
}
