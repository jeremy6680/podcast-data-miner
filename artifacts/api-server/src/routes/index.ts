import { Router, type IRouter } from "express";
import healthRouter from "./health";
import episodesRouter from "./episodes";
import syncRouter from "./sync";
import { handleMcpRequest } from "../mcp/server";

const router: IRouter = Router();

router.use(healthRouter);
router.use(episodesRouter);
router.use(syncRouter);

// MCP HTTP transport (Streamable HTTP). Single endpoint at /api/mcp.
router.all("/mcp", (req, res) => {
  void handleMcpRequest(req, res);
});

export default router;
