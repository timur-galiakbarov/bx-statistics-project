import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Check, ChevronRight, ExternalLink, FileText, FolderPlus, Lightbulb, Loader2, Plus, Search, Sparkles, X } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';
import './content.css';

type Rubric = { name: string; description: string };
type Source = { groupId: number; name: string; url: string; members: number; reason: string; examples: string[]; status: 'candidate' | 'selected' | 'excluded' };
type Project = { id: string; name: string; brief: string; targetUrl: string; audience: string; style: string; exclusions: string; rubrics: Rubric[]; sources: Source[]; lastScan: string | null; scanNotes: string[] };
type Reference = { key: string; sourceName: string; url: string; date: string; text: string; views: number; relative: number | null };
type Idea = { _id: string; title: string; rubric: string; reason: string; angle: string; checks: string; references: Reference[]; status: 'new' | 'saved' | 'rejected' | 'published'; feedback: string; draft: string };
const empty: Project = { id: '', name: '', brief: '', targetUrl: '', audience: '', style: '', exclusions: '', rubrics: [], sources: [], lastScan: null, scanNotes: [] };
const statuses = { new: 'Новые', saved: 'Сохранённые', published: 'Опубликованные', rejected: 'Отклонённые' };
const date = (value: string) => new Date(value).toLocaleDateString('ru-RU');
const count = (value: number) => new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(value);
const clone = (project: Project) => JSON.parse(JSON.stringify(project)) as Project;

function IdeaCard({ idea, busy, edits, onEdit, onUpdate, onDraft }: { idea: Idea; busy: boolean; edits?: Partial<Idea>; onEdit: (patch: Partial<Idea>) => void; onUpdate: (id: string, patch: Partial<Idea>) => Promise<void>; onDraft: (id: string) => Promise<void> }) {
  const draft = edits?.draft ?? idea.draft;
  const feedback = edits?.feedback ?? idea.feedback;
  const [copied, setCopied] = useState(false);
  return <article className="content-idea">
    <div className="content-row content-between"><span className="content-tag">{idea.rubric}</span><span className="content-muted">{statuses[idea.status]}</span></div>
    <h3>{idea.title}</h3><p>{idea.reason}</p>
    <div className="content-angle"><strong>Как подать у себя</strong><p>{idea.angle}</p></div>
    {idea.checks && <p className="content-checks"><strong>Проверить:</strong> {idea.checks}</p>}
    <details><summary>Источники · {idea.references.length}</summary><div className="content-references">{idea.references.map((reference) => <div key={reference.key}>
      <a href={reference.url} target="_blank" rel="noreferrer">{reference.sourceName} <ExternalLink size={13} /></a>
      <small>{date(reference.date)} · {count(reference.views)} просмотров{reference.relative !== null ? ` · ${reference.relative}× к обычным просмотрам источника` : ''}</small>
      <p>{reference.text}</p>
    </div>)}</div></details>
    {idea.draft ? <div className="content-draft"><label>Черновик<textarea rows={12} value={draft} onChange={(event) => { onEdit({ draft: event.target.value }); setCopied(false); }} maxLength={15000} /></label>
      <div className="content-row"><button className="primary-button" disabled={busy || draft === idea.draft} onClick={() => void onUpdate(idea._id, { draft })}>Сохранить текст</button><button className="secondary-button" onClick={() => void navigator.clipboard.writeText(draft).then(() => setCopied(true)).catch(() => setCopied(false))}>{copied ? 'Скопировано' : 'Копировать'}</button></div>
      <small className="content-muted">Перед публикацией проверьте факты и условия по первоисточникам.</small>
    </div> : <button className="content-draft-button" disabled={busy} onClick={() => void onDraft(idea._id)}><Sparkles size={16} /> Подготовить черновик</button>}
    <div className="content-idea-footer">
      <button disabled={busy} className={idea.status === 'saved' ? 'is-active' : ''} onClick={() => void onUpdate(idea._id, { status: idea.status === 'saved' ? 'new' : 'saved' })}><Bookmark size={15} />Сохранить</button>
      <button disabled={busy} className={idea.status === 'published' ? 'is-active' : ''} onClick={() => void onUpdate(idea._id, { status: idea.status === 'published' ? 'new' : 'published' })}><Check size={15} />Опубликовано</button>
      {idea.status === 'rejected' ? <button disabled={busy} onClick={() => void onUpdate(idea._id, { status: 'new' })}>Вернуть в новые</button> : <button disabled={busy} onClick={() => void onUpdate(idea._id, { status: 'rejected', feedback })}><X size={15} />Не подходит</button>}
    </div>
    <label className="content-feedback">Причина отказа или пожелание<input placeholder="Например: слишком сложно, больше практических кейсов" value={feedback} onChange={(event) => onEdit({ feedback: event.target.value })} maxLength={500} /></label>
    {feedback !== idea.feedback && <button className="secondary-button" disabled={busy} onClick={() => void onUpdate(idea._id, { feedback })}>Сохранить пожелание</button>}
  </article>;
}

export function ContentPage({ hasAccess }: { hasAccess: boolean }) {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project>(clone(empty));
  const [form, setForm] = useState<Project>(clone(empty));
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaEdits, setIdeaEdits] = useState<Record<string, Partial<Idea>>>({});
  const [tab, setTab] = useState<'ideas' | 'sources' | 'settings'>('settings');
  const [filter, setFilter] = useState<keyof typeof statuses>('new');
  const [rubricFilter, setRubricFilter] = useState('');
  const [period, setPeriod] = useState(7);
  const [sourceRef, setSourceRef] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(0);
  const dirty = JSON.stringify(form) !== JSON.stringify(project);
  const unsavedIdeas = ideas.some((idea) => Object.entries(ideaEdits[idea._id] ?? {}).some(([key, value]) => value !== idea[key as keyof Idea]));
  useEffect(() => {
    if (!dirty && !unsavedIdeas) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (anchor && anchor.target !== '_blank' && anchor.origin === window.location.origin && !window.confirm('Уйти без сохранения изменений?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', navigate, true); };
  }, [dirty, unsavedIdeas]);
  const accept = (next: Project) => {
    setProject(next); setForm(clone(next));
    setProjects((current) => [next, ...current.filter((p) => p.id !== next.id)]);
  };
  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    const current = ++request.current;
    setLoading(true);
    void apiGet<Project[]>('/api/content/projects').then(async (list) => {
      if (current !== request.current) return;
      setProjects(list);
      const chosen = list.find((p) => p.id === params.get('project')) ?? list[0];
      if (!chosen) return;
      const loadedIdeas = await apiGet<Idea[]>(`/api/content/projects/${chosen.id}/ideas`);
      if (current !== request.current) return;
      setProject(chosen); setForm(clone(chosen)); setIdeas(loadedIdeas); setTab(chosen.rubrics.length ? 'ideas' : 'settings');
    }).catch((e: Error) => { if (current === request.current) setError(e.message); }).finally(() => { if (current === request.current) setLoading(false); });
    return () => { request.current++; };
  }, [hasAccess]);
  const run = async (label: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие.'); } finally { setBusy(''); }
  };
  const choose = async (id: string) => {
    if ((dirty || unsavedIdeas) && !window.confirm('Перейти без сохранения изменений проекта и черновиков?')) return;
    await run('Открываем проект', async () => {
      const next = projects.find((p) => p.id === id);
      if (!next) return;
      const [fresh, loaded] = await Promise.all([apiGet<Project>(`/api/content/projects/${id}`), apiGet<Idea[]>(`/api/content/projects/${id}/ideas`)]);
      accept(fresh); setIdeas(loaded); setIdeaEdits({}); setParams({ project: id }); setTab('ideas'); setRubricFilter('');
    });
  };
  const save = async () => run('Сохраняем проект', async () => {
    const next = project.id ? await apiPatch<Project>(`/api/content/projects/${project.id}`, form) : await apiPost<Project>('/api/content/projects', form);
    accept(next); setParams({ project: next.id }); setNotice('Проект сохранён.');
  });
  const updateIdea = async (id: string, patch: Partial<Idea>) => run('Сохраняем материал', async () => {
    const next = await apiPatch<Idea>(`/api/content/projects/${project.id}/ideas/${id}`, patch);
    setIdeas((items) => items.map((i) => i._id === id ? next : i));
    setIdeaEdits((current) => { const edits = { ...current[id] }; for (const key of Object.keys(patch)) delete edits[key as keyof Idea]; return { ...current, [id]: edits }; });
  });
  const patchForm = (key: 'name' | 'brief' | 'targetUrl' | 'audience' | 'style' | 'exclusions', value: string) => setForm((current) => ({ ...current, [key]: value }));
  const selected = project.sources.filter((s) => s.status === 'selected');
  const shownIdeas = ideas.filter((i) => i.status === filter && (!rubricFilter || i.rubric === rubricFilter));
  if (!hasAccess) return <section className="panel content-page"><h2>Контент для вашей группы</h2><p>Проекты, подбор источников, идеи по рубрикам и подготовка черновиков доступны на активном тарифе.</p><Link className="primary-button" to="/account">Перейти к оплате</Link></section>;
  if (loading) return <section className="panel content-page" aria-busy="true">Загружаем проекты…</section>;
  return <section className="content-page">
    <header className="content-hero"><div><span className="content-eyebrow"><Sparkles size={14} /> Помощник редактора</span><h2>От хорошей идеи к своему посту</h2><p>Соберите источники, находите полезные сюжеты и готовьте публикации для своей аудитории.</p></div><div className="content-hero-icon"><FileText size={34} /></div></header>
    <div className="content-project-bar"><label>Проект<select disabled={!!busy} value={project.id} onChange={(event) => void choose(event.target.value)}><option value="" disabled>Новый проект</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button className="secondary-button" disabled={!!busy} onClick={() => { if ((dirty || unsavedIdeas) && !window.confirm('Создать проект без сохранения текущих изменений и черновиков?')) return; setProject(clone(empty)); setForm(clone(empty)); setIdeas([]); setIdeaEdits({}); setTab('settings'); setParams({}); setError(''); setNotice(''); }}><FolderPlus size={17} />Новый проект</button>
      {project.targetUrl && <a className="content-target" href={project.targetUrl} target="_blank" rel="noreferrer">Открыть свою группу <ExternalLink size={14} /></a>}
    </div>
    <nav className="content-tabs" aria-label="Разделы проекта">{([['settings', '1', 'Проект и рубрики'], ['sources', '2', 'Источники'], ['ideas', '3', 'Идеи и черновики']] as const).map(([key, number, label]) => <button key={key} className={tab === key ? 'is-active' : ''} disabled={!!busy || (!project.id && key !== 'settings')} onClick={() => setTab(key)}><span>{number}</span>{label}{key === 'sources' && project.sources.length ? <small>{selected.length}</small> : null}</button>)}</nav>
    {error && <div role="alert" className="content-message content-error">{error}</div>}
    {notice && <div role="status" className="content-message">{notice}</div>}
    {busy && <div role="status" className="content-progress" aria-live="polite"><Loader2 className="content-spin" size={18} /><div><strong>{busy}…</strong><small>Подбор источников может занять несколько минут. Дождитесь завершения.</small></div></div>}
    {dirty && project.id && tab !== 'settings' && <div className="content-message">В настройках есть несохранённые изменения. <button onClick={() => setTab('settings')}>Вернуться к настройкам</button></div>}
    {tab === 'settings' && <div className="content-panel"><div className="content-section-heading"><div><h3>{project.id ? 'Настройки проекта' : 'Начните со своей задачи'}</h3><p>Опишите, для кого и о чём хотите публиковать. Ссылку можно добавить позже.</p></div></div>
      <fieldset disabled={!!busy} className="content-fields"><div className="content-two-columns"><label>Название проекта<input value={form.name} maxLength={80} placeholder="Например: личные финансы" onChange={(event) => patchForm('name', event.target.value)} /></label><label>Своя группа ВК или Telegram-канал<input value={form.targetUrl} maxLength={250} placeholder="https://vk.com/… или https://t.me/…" onChange={(event) => patchForm('targetUrl', event.target.value)} /></label></div>
        <label>Какие публикации хотите готовить?<textarea rows={4} maxLength={3000} value={form.brief} placeholder="Кому пишете, какие темы интересны, что читатель должен получить от публикаций" onChange={(event) => patchForm('brief', event.target.value)} /></label>
        <div className="content-row"><button className="primary-button" disabled={!form.name.trim() || !form.brief.trim() || (!dirty && !!project.id)} onClick={() => void save()}>Сохранить проект</button><button className="secondary-button" disabled={!project.id || dirty} onClick={() => void run('Предлагаем профиль и рубрики', async () => {
          const profile = await apiPost<Pick<Project, 'audience' | 'style' | 'exclusions' | 'rubrics'>>(`/api/content/projects/${project.id}/profile`);
          setForm((current) => ({ ...current, ...profile })); setNotice('ИИ предложил профиль и рубрики. Проверьте, поправьте и сохраните проект.');
        })}><Sparkles size={16} />Предложить рубрики</button></div>
        <div className="content-divider" /><div className="content-two-columns"><label>Для кого пишем<textarea rows={3} value={form.audience} maxLength={1000} onChange={(event) => patchForm('audience', event.target.value)} /></label><label>Стиль публикаций<textarea rows={3} value={form.style} maxLength={1000} onChange={(event) => patchForm('style', event.target.value)} /></label></div><label>Что исключить<textarea rows={2} value={form.exclusions} maxLength={1000} placeholder="Например: реклама курсов, обещания быстрого заработка" onChange={(event) => patchForm('exclusions', event.target.value)} /></label>
        <div className="content-section-heading"><div><h3>Рубрики <span className="content-muted">{form.rubrics.length}/8</span></h3><p>Укажите тему, подходящие форматы и исключения.</p></div><button className="secondary-button" disabled={form.rubrics.length >= 8} onClick={() => setForm((current) => ({ ...current, rubrics: [...current.rubrics, { name: '', description: '' }] }))}><Plus size={16} />Рубрика</button></div>
        {!form.rubrics.length && <div className="content-empty-small">Добавьте рубрики вручную или сохраните проект и нажмите «Предложить рубрики».</div>}
        {form.rubrics.map((rubric, index) => <div className="content-rubric" key={index}><span className="content-rubric-number">{index + 1}</span><div><label>Название<input aria-label={`Название рубрики ${index + 1}`} value={rubric.name} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, rubrics: current.rubrics.map((r, n) => n === index ? { ...r, name: event.target.value } : r) }))} /></label><label>Описание и форматы<textarea aria-label={`Описание рубрики ${index + 1}`} rows={2} value={rubric.description} maxLength={500} onChange={(event) => setForm((current) => ({ ...current, rubrics: current.rubrics.map((r, n) => n === index ? { ...r, description: event.target.value } : r) }))} /></label></div><button className="content-icon-button" aria-label={`Удалить рубрику ${index + 1}`} onClick={() => setForm((current) => ({ ...current, rubrics: current.rubrics.filter((_, n) => n !== index) }))}><X size={18} /></button></div>)}
        {project.id && <div className="content-row"><button className="primary-button" disabled={!dirty} onClick={() => void save()}>Сохранить настройки</button><button className="secondary-button" disabled={dirty || !project.rubrics.length} onClick={() => setTab('sources')}>К источникам <ChevronRight size={16} /></button><button className="content-delete" onClick={() => { if (!window.confirm('Удалить проект, все его идеи и черновики?')) return; void run('Удаляем проект', async () => { await apiDelete(`/api/content/projects/${project.id}`); setProjects((current) => current.filter((p) => p.id !== project.id)); setProject(clone(empty)); setForm(clone(empty)); setIdeas([]); setIdeaEdits({}); setParams({}); setNotice('Проект удалён.'); }); }}>Удалить проект</button></div>}
      </fieldset></div>}
    {tab === 'sources' && <div className="content-panel"><div className="content-section-heading"><div><h3>Источники для ваших рубрик</h3><p>ИИ предложит сообщества ВК и объяснит выбор. Вы решаете, какие читать.</p></div><button className="primary-button" disabled={!!busy || dirty || !project.rubrics.length} onClick={() => void run('Ищем и проверяем сообщества', async () => { const result = await apiPost<{ project: Project; message: string }>(`/api/content/projects/${project.id}/discover`); accept(result.project); setNotice(result.message); })}><Sparkles size={16} />Подобрать с ИИ</button></div>
      <form className="content-add-source" onSubmit={(event) => { event.preventDefault(); void run('Добавляем источник', async () => { accept(await apiPost<Project>(`/api/content/projects/${project.id}/sources`, { ref: sourceRef })); setSourceRef(''); }); }}><label>Добавить сообщество ВК по ссылке<input placeholder="https://vk.com/…" value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} disabled={!!busy} /></label><button className="secondary-button" disabled={!!busy || !sourceRef.trim() || dirty} type="submit"><Plus size={16} />Добавить</button></form>
      <p className="content-muted">Выбрано {selected.length} из 15 источников для сканирования. Автоматический подбор Telegram-источников пока недоступен.</p>
      {!project.sources.length && <div className="content-empty"><Search size={30} /><h3>Найдём, у кого есть интересные материалы</h3><p>Добавьте знакомое сообщество или запустите подбор по рубрикам.</p></div>}
      <div className="content-source-list">{project.sources.map((source) => <article key={source.groupId} className={`content-source ${source.status === 'excluded' ? 'content-source-excluded' : ''}`}><div className="content-source-avatar">{source.name.slice(0, 1)}</div><div className="content-source-main"><div className="content-row"><a href={source.url} target="_blank" rel="noreferrer"><strong>{source.name}</strong> <ExternalLink size={13} /></a><span className="content-muted">{count(source.members)} подписчиков</span></div><p>{source.reason}</p><div className="content-row">{source.examples.map((url, i) => <a href={url} key={url} target="_blank" rel="noreferrer" className="content-example">Пример {i + 1} <ExternalLink size={12} /></a>)}</div></div><select aria-label={`Статус источника ${source.name}`} value={source.status} disabled={!!busy || dirty} onChange={(event) => void run('Сохраняем источник', async () => accept(await apiPatch<Project>(`/api/content/projects/${project.id}/sources/${source.groupId}`, { status: event.target.value })))}><option value="candidate">На рассмотрении</option><option value="selected">Читать</option><option value="excluded">Исключить</option></select><button className="content-icon-button" disabled={!!busy || dirty} aria-label={`Удалить источник ${source.name}`} title="Удалить из проекта" onClick={() => { if (!window.confirm('Удалить источник из проекта? При следующем подборе он может появиться снова. Чтобы не предлагать его, выберите «Исключить».')) return; void run('Удаляем источник', async () => accept(await apiDelete<Project>(`/api/content/projects/${project.id}/sources/${source.groupId}`))); }}><X size={16} /></button></article>)}</div>
      {!!selected.length && <button className="secondary-button" onClick={() => setTab('ideas')}>К подборке идей <ChevronRight size={16} /></button>}
    </div>}
    {tab === 'ideas' && <><div className="content-panel content-scan"><div><h3>Что опубликовать дальше?</h3><p>{selected.length ? `Источников: ${selected.length} · Рубрик: ${project.rubrics.length}` : 'Сначала выберите источники во второй вкладке.'}{project.lastScan && ` · Последний подбор ${date(project.lastScan)}`}</p></div><div className="content-row"><select aria-label="Период подбора" value={period} disabled={!!busy} onChange={(event) => setPeriod(Number(event.target.value))}>{[7, 14, 30].map((days) => <option value={days} key={days}>За {days} дней</option>)}</select><button className="primary-button" disabled={!!busy || dirty || !selected.length || !project.rubrics.length} onClick={() => void run('Читаем источники и подбираем идеи', async () => { const result = await apiPost<{ project: Project; ideas: Idea[]; message: string }>(`/api/content/projects/${project.id}/scan`, { days: period }); accept(result.project); setIdeas(result.ideas); setFilter('new'); setNotice(result.message); })}><Sparkles size={16} />Подобрать идеи</button></div></div>
      {project.scanNotes.length > 0 && <div className="content-message">{project.scanNotes.map((note) => <p key={note}>{note}</p>)}</div>}
      <div className="content-idea-filters"><div className="content-statuses">{(Object.keys(statuses) as Array<keyof typeof statuses>).map((status) => <button className={filter === status ? 'is-active' : ''} key={status} onClick={() => setFilter(status)}>{statuses[status]} <small>{ideas.filter((i) => i.status === status).length}</small></button>)}</div><select aria-label="Рубрика" value={rubricFilter} onChange={(event) => setRubricFilter(event.target.value)}><option value="">Все рубрики</option>{[...new Set([...project.rubrics.map((r) => r.name), ...ideas.map((i) => i.rubric)])].map((name) => <option key={name}>{name}</option>)}</select></div>
      {!shownIdeas.length && <div className="content-panel content-empty"><Lightbulb size={34} /><h3>{ideas.length ? 'Здесь пока нет материалов' : 'Ваша следующая публикация начинается здесь'}</h3><p>{ideas.length ? 'Попробуйте другую рубрику или подберите свежие идеи.' : 'Запустите подбор. Здесь появятся идеи с источниками, объяснением и подходом для вашей группы.'}</p>{!selected.length && <button className="secondary-button" onClick={() => setTab('sources')}>Выбрать источники</button>}</div>}
      <div className="content-ideas-grid">{shownIdeas.map((idea) => <IdeaCard key={idea._id} idea={idea} busy={!!busy} edits={ideaEdits[idea._id]} onEdit={(patch) => setIdeaEdits((current) => ({ ...current, [idea._id]: { ...current[idea._id], ...patch } }))} onUpdate={updateIdea} onDraft={(id) => run('Готовим черновик', async () => { const next = await apiPost<Idea>(`/api/content/projects/${project.id}/ideas/${id}/draft`); setIdeas((items) => items.map((i) => i._id === id ? next : i)); })} />)}</div>
    </>}
  </section>;
}
