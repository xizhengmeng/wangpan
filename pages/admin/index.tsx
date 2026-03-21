import { GetServerSideProps } from "next";

import { requireAdminAuth } from "@/lib/auth";

export default function AdminIndex() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) =>
  requireAdminAuth(ctx, async () => ({
    redirect: { destination: "/admin/resources", permanent: false },
  }));
