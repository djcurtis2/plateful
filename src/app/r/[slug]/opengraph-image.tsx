import { ImageResponse } from "next/og";
import { getRecipeBySlug } from "@/lib/data";
import { savings } from "@/lib/recipe";
import { money } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Plateful copycat recipe";

/** The preview card shown when a recipe link is pasted into a chat or social app. */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRecipeBySlug(slug);
  const s = r ? savings(r) : null;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#24563A", color: "#fff", fontFamily: "sans-serif" }}>
        {r?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image_url} alt="" width={560} height={630} style={{ objectFit: "cover", width: 560, height: 630 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: "#F2B630", fontSize: 26, letterSpacing: 2 }}>
              {`COPYCAT${r?.restaurant ? " · " + r.restaurant.toUpperCase() : ""}`}
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>{r?.dish ?? "Plateful"}</div>
          </div>
          {s ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 40, fontSize: 30 }}>
                <span>{`${money(r!.menu_price)} out`}</span>
                <span style={{ color: "#B8E6C6" }}>{`${money(r!.plate_cost)} at home`}</span>
              </div>
              <div style={{ display: "flex", background: "#F2B630", color: "#3A2A00", borderRadius: 20, padding: "18px 26px", fontSize: 40, fontWeight: 700 }}>
                {`Save ${money(s.saved)} a plate`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 32 }}>Snap a dish. Make it at home.</div>
          )}
          <div style={{ fontSize: 34, fontWeight: 700 }}>Plateful</div>
        </div>
      </div>
    ),
    size,
  );
}
