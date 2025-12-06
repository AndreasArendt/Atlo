export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const key = process.env.MAPTILER_API_KEY;
  if (!key) {
    return res.status(500).send("MAPTILER_API_KEY is not configured.");
  }

  res.status(200).json({ key });
}
