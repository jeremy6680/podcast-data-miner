import { Router, type IRouter } from "express";
import { TriggerSyncBody } from "@workspace/api-zod";
import { startSync, getSyncStatus } from "../sync/runner";

const router: IRouter = Router();

router.post("/sync", async (req, res) => {
  const parsed = TriggerSyncBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  await startSync(parsed.data);
  const status = await getSyncStatus();
  res.status(202).json(status);
});

router.get("/sync/status", async (_req, res) => {
  const status = await getSyncStatus();
  res.json(status);
});

export default router;
