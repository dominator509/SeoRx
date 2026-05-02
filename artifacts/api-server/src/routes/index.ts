import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import clientsRouter from "./clients";
import auditsRouter from "./audits";
import issuesRouter from "./issues";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import aiProvidersRouter from "./ai-providers";
import pagespeedRouter from "./pagespeed";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(clientsRouter);
router.use(auditsRouter);
router.use(issuesRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(aiProvidersRouter);
router.use(pagespeedRouter);

export default router;
