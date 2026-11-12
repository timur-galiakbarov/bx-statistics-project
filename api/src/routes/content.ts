import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { addSource, contentOperation, deleteProject, discoverSources, editIdea, generateDraft, getIdeas, listProjects, ownProject, publicProject, removeSource, saveProject, scanIdeas, setSource, suggestProfile } from '../services/contentService.js';
import { invalid } from '../services/contentUtils.js';

export const contentRouter = Router();
contentRouter.use(requireUser, requireAdmin);
const route = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST' || req.method === 'PATCH') {
      if (req.body === undefined) req.body = {};
      if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') invalid('Не удалось прочитать данные формы.');
    }
    res.json({ success: true, data: await fn(req) });
  } catch (error) { next(error); }
};
contentRouter.get('/projects', route((req) => listProjects(req.user!.id)));
contentRouter.post('/projects', route((req) => saveProject(req.user!.id, null, req.body)));
contentRouter.get('/projects/:id', route(async (req) => publicProject(await ownProject(req.user!.id, req.params.id))));
contentRouter.patch('/projects/:id', route((req) => saveProject(req.user!.id, req.params.id, req.body)));
contentRouter.delete('/projects/:id', route((req) => deleteProject(req.user!.id, req.params.id)));
contentRouter.get('/projects/:id/ideas', route((req) => getIdeas(req.user!.id, req.params.id)));
contentRouter.post('/projects/:id/profile', route((req) => contentOperation(req.user!.id, req.params.id, (project) => suggestProfile(req.user!.id, project))));
contentRouter.post('/projects/:id/sources', route((req) => contentOperation(req.user!.id, req.params.id, (project) => addSource(req.user!.id, project, req.body.ref))));
contentRouter.post('/projects/:id/discover', route((req) => contentOperation(req.user!.id, req.params.id, (project) => discoverSources(req.user!.id, project))));
contentRouter.patch('/projects/:id/sources/:groupId', route((req) => setSource(req.user!.id, req.params.id, Number(req.params.groupId), req.body.status)));
contentRouter.delete('/projects/:id/sources/:groupId', route((req) => removeSource(req.user!.id, req.params.id, Number(req.params.groupId))));
contentRouter.post('/projects/:id/scan', route((req) => contentOperation(req.user!.id, req.params.id, (project) => scanIdeas(req.user!.id, project, req.body.days))));
contentRouter.patch('/projects/:id/ideas/:ideaId', route((req) => editIdea(req.user!.id, req.params.id, req.params.ideaId, req.body)));
contentRouter.post('/projects/:id/ideas/:ideaId/draft', route((req) => contentOperation(req.user!.id, req.params.id, (project) => generateDraft(req.user!.id, project, req.params.ideaId))));
