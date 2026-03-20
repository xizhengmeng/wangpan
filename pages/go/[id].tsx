import { GetServerSideProps } from "next";

import { getResourceById, recordEvent } from "@/lib/store";

export default function GoPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const id = String(params?.id || "");
  const resource = getResourceById(id);

  if (!resource) {
    return {
      notFound: true
    };
  }

  if (resource.publish_status === "offline") {
    return {
      redirect: {
        destination: `/resource/${resource.slug}`,
        permanent: false
      }
    };
  }

  recordEvent({
    name: "outbound_quark_click",
    resource_id: resource.id,
    referer: req.headers.referer,
    ua: req.headers["user-agent"]
  });
  recordEvent({
    name: "outbound_quark_redirect_done",
    resource_id: resource.id,
    referer: req.headers.referer,
    ua: req.headers["user-agent"]
  });

  return {
    redirect: {
      destination: resource.quark_url,
      permanent: false
    }
  };
};
