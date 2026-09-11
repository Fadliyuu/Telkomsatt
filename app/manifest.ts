import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Telkomsat Inventaris", short_name: "Inventaris",
    start_url: "/", display: "standalone", background_color: "#0d0f12", theme_color: "#0d0f12",
    icons: [{ src: "/logo/ODF.png", type: "image/png" }],
  };
}
