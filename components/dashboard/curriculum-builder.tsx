"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, FileText, GripVertical, ListTree, Paperclip, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

import { LessonSheet, videoBadge } from "@/components/dashboard/lesson-sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  addCourseLesson,
  addCourseModule,
  deleteCourseLesson,
  deleteCourseModule,
  getCourseCurriculum,
  renameCourseModule,
  saveCourseLayout,
  type CurriculumResult,
} from "@/lib/courses/curriculum-actions";
import { lessonCount, type Curriculum, type EditorLesson, type EditorModule } from "@/lib/courses/curriculum-types";
import { COURSE_LIMITS } from "@/lib/courses/settings";
import { cn } from "@/lib/utils";

const moduleKey = (id: string) => `m:${id}`;
const lessonKey = (id: string) => `l:${id}`;
const isModuleKey = (key: string) => key.startsWith("m:");
const idOf = (key: string) => key.slice(2);

const layoutOf = (modules: EditorModule[]) => ({
  moduleIds: modules.map((module) => module.id),
  lessons: modules.map((module) => ({ moduleId: module.id, lessonIds: module.lessons.map((lesson) => lesson.id) })),
});

/**
 * The course curriculum builder (D-055): modules as an accordion, lessons inside. Drag the handle
 * (mouse, touch, or keyboard: Space then arrows) or use the up/down buttons to reorder; lessons can
 * move between modules. Every change is saved at once and the server's curriculum comes back.
 */
export function CurriculumBuilder({
  courseId,
  curriculum,
  videoUploadReady,
  onChange,
}: {
  courseId: string;
  curriculum: Curriculum;
  videoUploadReady: boolean;
  onChange: (curriculum: Curriculum) => void;
}) {
  const [modules, setModules] = useState(curriculum.modules);
  const [synced, setSynced] = useState(curriculum);
  const [open, setOpen] = useState<string[]>(curriculum.modules.slice(0, 1).map((module) => module.id));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newModule, setNewModule] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // A new curriculum from the editor replaces the local copy (adjusted while rendering).
  if (curriculum !== synced) {
    setSynced(curriculum);
    setModules(curriculum.modules);
  }

  const apply = (result: CurriculumResult): boolean => {
    if (!result.ok) {
      setProblem(result.error);
      setModules(synced.modules);
      return false;
    }
    setProblem(null);
    onChange(result.data);
    return true;
  };

  const act = async (work: () => Promise<CurriculumResult>) => {
    setBusy(true);
    const result = await work();
    setBusy(false);
    return apply(result);
  };

  const reload = () => void getCourseCurriculum(courseId).then(apply);

  // While a video is uploading or processing, check now and then until Bunny says it is ready.
  const waiting = modules.some((module) => module.lessons.some((lesson) => lesson.video?.kind === "bunny" && (lesson.video.status === "uploading" || lesson.video.status === "processing")));
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void getCourseCurriculum(courseId).then((result) => result.ok && onChange(result.data)), 15_000);
    return () => clearInterval(timer);
  }, [waiting, courseId, onChange]);

  const persist = (next: EditorModule[]) => {
    setModules(next);
    void act(() => saveCourseLayout(courseId, layoutOf(next)));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const containerOf = (key: string): string | null => {
    if (isModuleKey(key)) return idOf(key);
    return modules.find((module) => module.lessons.some((lesson) => lesson.id === idOf(key)))?.id ?? null;
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveKey(String(active.id));

  // A lesson dragged over another module moves into it right away, so it can be placed there.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const from = String(active.id);
    if (!over || isModuleKey(from)) return;
    const source = containerOf(from);
    const target = containerOf(String(over.id));
    if (!source || !target || source === target) return;
    setModules((current) => {
      const lesson = current.find((module) => module.id === source)?.lessons.find((item) => item.id === idOf(from));
      if (!lesson) return current;
      return current.map((module) => {
        if (module.id === source) return { ...module, lessons: module.lessons.filter((item) => item.id !== lesson.id) };
        if (module.id !== target) return module;
        const overIndex = isModuleKey(String(over.id)) ? module.lessons.length : module.lessons.findIndex((item) => item.id === idOf(String(over.id)));
        const lessons = [...module.lessons];
        lessons.splice(overIndex < 0 ? lessons.length : overIndex, 0, lesson);
        return { ...module, lessons };
      });
    });
    setOpen((current) => (current.includes(target) ? current : [...current, target]));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveKey(null);
    const from = String(active.id);
    if (!over) {
      setModules(synced.modules);
      return;
    }
    const to = String(over.id);
    if (isModuleKey(from)) {
      const oldIndex = modules.findIndex((module) => module.id === idOf(from));
      const newIndex = modules.findIndex((module) => module.id === containerOf(to));
      persist(oldIndex === newIndex || newIndex < 0 ? modules : arrayMove(modules, oldIndex, newIndex));
      return;
    }
    const container = containerOf(from);
    const next = modules.map((module) => {
      if (module.id !== container || isModuleKey(to)) return module;
      const oldIndex = module.lessons.findIndex((lesson) => lesson.id === idOf(from));
      const newIndex = module.lessons.findIndex((lesson) => lesson.id === idOf(to));
      return oldIndex < 0 || newIndex < 0 ? module : { ...module, lessons: arrayMove(module.lessons, oldIndex, newIndex) };
    });
    persist(next);
  };

  const moveModule = (index: number, delta: number) => persist(arrayMove(modules, index, index + delta));
  const moveLesson = (moduleIndex: number, lessonIndex: number, delta: number) =>
    persist(modules.map((module, i) => (i === moduleIndex ? { ...module, lessons: arrayMove(module.lessons, lessonIndex, lessonIndex + delta) } : module)));

  const addModuleNow = async () => {
    if (!newModule.trim() || busy) return;
    if (await act(() => addCourseModule(courseId, newModule))) setNewModule("");
  };

  const total = lessonCount({ modules });
  const editingLesson = editing ? modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === editing) : undefined;
  const activeLesson = activeKey && !isModuleKey(activeKey) ? modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === idOf(activeKey)) : undefined;
  const activeModule = activeKey && isModuleKey(activeKey) ? modules.find((module) => module.id === idOf(activeKey)) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mute" aria-live="polite">
        {modules.length} {modules.length === 1 ? "module" : "modules"}, {total} {total === 1 ? "lesson" : "lessons"}
      </p>

      {problem && (
        <Alert variant="error">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      {modules.length === 0 ? (
        <Empty className="border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTree aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Start with a module</EmptyTitle>
            <EmptyDescription>Modules group your lessons, like &ldquo;Module 1: Introduction&rdquo;. Add one below, then add lessons to it.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => (setActiveKey(null), setModules(synced.modules))}>
          <SortableContext items={modules.map((module) => moduleKey(module.id))} strategy={verticalListSortingStrategy}>
            <Accordion type="multiple" value={open} onValueChange={setOpen} className="flex flex-col gap-3">
              {modules.map((module, moduleIndex) => (
                <SortableModule key={module.id} module={module}>
                  {(handle) => (
                    <ModuleCard
                      courseId={courseId}
                      module={module}
                      index={moduleIndex}
                      count={modules.length}
                      handle={handle}
                      busy={busy}
                      act={act}
                      onMove={(delta) => moveModule(moduleIndex, delta)}
                    >
                      <SortableContext items={module.lessons.map((lesson) => lessonKey(lesson.id))} strategy={verticalListSortingStrategy}>
                        <ol className="flex flex-col gap-2">
                          {module.lessons.map((lesson, lessonIndex) => (
                            <SortableLesson key={lesson.id} lesson={lesson}>
                              {(lessonHandle) => (
                                <LessonRow
                                  lesson={lesson}
                                  handle={lessonHandle}
                                  first={lessonIndex === 0}
                                  last={lessonIndex === module.lessons.length - 1}
                                  busy={busy}
                                  onEdit={() => setEditing(lesson.id)}
                                  onMove={(delta) => moveLesson(moduleIndex, lessonIndex, delta)}
                                  onDelete={() => act(() => deleteCourseLesson(courseId, lesson.id))}
                                />
                              )}
                            </SortableLesson>
                          ))}
                        </ol>
                      </SortableContext>
                    </ModuleCard>
                  )}
                </SortableModule>
              ))}
            </Accordion>
          </SortableContext>
          <DragOverlay>
            {activeLesson ? <div className="rounded-md border border-blue bg-surface px-4 py-3 font-semibold shadow-popover">{activeLesson.title}</div> : null}
            {activeModule ? <div className="rounded-md border border-blue bg-surface px-4 py-3 font-semibold shadow-popover">{activeModule.title}</div> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Not a form element: the builder sits inside the course editor's form, and a nested form
          would submit the editor instead. Enter and the button are handled here. */}
      <div role="group" aria-label="Add a module" className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="New module title"
          value={newModule}
          maxLength={COURSE_LIMITS.moduleTitle}
          onChange={(event) => setNewModule(event.target.value)}
          onKeyDown={(event) => onEnter(event, addModuleNow)}
          placeholder={`Module ${modules.length + 1}: Introduction`}
        />
        <Button type="button" variant="secondary" onClick={addModuleNow} disabled={busy || !newModule.trim() || modules.length >= COURSE_LIMITS.modulesMax} className="shrink-0">
          <Plus aria-hidden="true" className="size-4" />
          Add module
        </Button>
      </div>

      {editingLesson && <LessonSheet key={editingLesson.id} courseId={courseId} lesson={editingLesson} videoUploadReady={videoUploadReady} onClose={() => setEditing(null)} onChange={apply} onReload={reload} />}
    </div>
  );
}

/** What a drag handle needs from useSortable; `activator` marks the element that starts a drag. */
/**
 * Enter in a builder field runs its action instead of submitting the course editor's form around
 * the builder (the browser's implicit submit).
 */
function onEnter(event: KeyboardEvent<HTMLInputElement>, run: () => void) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  run();
}

type Handle = { attributes: ReturnType<typeof useSortable>["attributes"]; listeners: ReturnType<typeof useSortable>["listeners"]; activator: (element: HTMLElement | null) => void };

function SortableModule({ module, children }: { module: EditorModule; children: (handle: Handle) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: moduleKey(module.id) });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      {children({ attributes, listeners, activator: setActivatorNodeRef })}
    </div>
  );
}

function SortableLesson({ lesson, children }: { lesson: EditorLesson; children: (handle: Handle) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: lessonKey(lesson.id) });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      {children({ attributes, listeners, activator: setActivatorNodeRef })}
    </li>
  );
}

function DragHandle({ handle: { attributes, listeners, activator }, label }: { handle: Handle; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" ref={activator} {...attributes} {...listeners} aria-label={label} className="shrink-0 cursor-grab touch-none text-mute active:cursor-grabbing">
      <GripVertical aria-hidden="true" className="size-4" />
    </Button>
  );
}

function ModuleCard({
  courseId,
  module,
  index,
  count,
  handle,
  busy,
  act,
  onMove,
  children,
}: {
  courseId: string;
  module: EditorModule;
  index: number;
  count: number;
  handle: Handle;
  busy: boolean;
  act: (work: () => Promise<CurriculumResult>) => Promise<boolean>;
  onMove: (delta: number) => void;
  children: ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(module.title);
  const [newLesson, setNewLesson] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const renameNow = async () => {
    if (!title.trim() || busy) return;
    if (await act(() => renameCourseModule(courseId, module.id, title))) setRenaming(false);
  };
  const addLessonNow = async () => {
    if (!newLesson.trim() || busy) return;
    if (await act(() => addCourseLesson(courseId, module.id, newLesson))) setNewLesson("");
  };

  return (
    <AccordionItem value={module.id} className="rounded-md border border-line bg-surface last:border-b">
      <div className="flex items-center gap-1 pr-2 pl-1">
        <DragHandle handle={handle} label={`Drag to reorder module ${module.title}`} />
        {renaming ? (
          <div role="group" aria-label="Rename module" className="flex flex-1 items-center gap-2 py-2">
            <Input aria-label="Module title" value={title} maxLength={COURSE_LIMITS.moduleTitle} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => onEnter(event, renameNow)} autoFocus className="h-10" />
            <Button type="button" size="sm" onClick={renameNow} disabled={busy || !title.trim()}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => (setTitle(module.title), setRenaming(false))}>
              Cancel
            </Button>
          </div>
        ) : (
          <AccordionTrigger className="min-w-0 flex-1 gap-3 px-2">
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{module.title}</span>
              <span className="text-xs font-normal text-mute">
                {module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </span>
          </AccordionTrigger>
        )}
        {!renaming && (
          <div className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move module ${module.title} up`} disabled={busy || index === 0} onClick={() => onMove(-1)}>
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move module ${module.title} down`} disabled={busy || index === count - 1} onClick={() => onMove(1)}>
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Rename module ${module.title}`} onClick={() => setRenaming(true)}>
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <AccordionContent className="flex flex-col gap-3 border-t border-line px-3 pt-3">
        {module.lessons.length === 0 && <p className="text-sm text-mute">No lessons yet. Add one below, or drag a lesson here.</p>}
        {children}
        <div role="group" aria-label={`Add a lesson to ${module.title}`} className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={`New lesson in ${module.title}`}
            value={newLesson}
            maxLength={COURSE_LIMITS.lessonTitle}
            onChange={(event) => setNewLesson(event.target.value)}
            onKeyDown={(event) => onEnter(event, addLessonNow)}
            placeholder="Lesson title"
            className="h-10"
          />
          <Button type="button" size="sm" variant="secondary" onClick={addLessonNow} disabled={busy || !newLesson.trim()} className="h-10 shrink-0">
            <Plus aria-hidden="true" className="size-4" />
            Add lesson
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {confirmDelete ? (
            <>
              <span className="text-sm font-medium">
                Delete &ldquo;{module.title}&rdquo; and its {module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}?
              </span>
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => act(() => deleteCourseModule(courseId, module.id))}>
                Yes, delete
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Delete module
            </Button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function LessonRow({
  lesson,
  handle,
  first,
  last,
  busy,
  onEdit,
  onMove,
  onDelete,
}: {
  lesson: EditorLesson;
  handle: Handle;
  first: boolean;
  last: boolean;
  busy: boolean;
  onEdit: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const badge = videoBadge(lesson.video);
  const Icon = lesson.video ? PlayCircle : lesson.attachments.length > 0 ? Paperclip : FileText;
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-bg-subtle py-1 pr-2 pl-1">
      <DragHandle handle={handle} label={`Drag to reorder lesson ${lesson.title}`} />
      <Icon aria-hidden="true" className="size-4 shrink-0 text-blue" />
      <Button type="button" variant="ghost" onClick={onEdit} className="h-auto min-w-0 flex-1 justify-start truncate px-2 py-2 text-left text-sm font-semibold not-disabled:hover:bg-transparent not-disabled:hover:text-blue">
        <span className="truncate">{lesson.title}</span>
      </Button>
      {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      {confirmDelete ? (
        <span className="flex items-center gap-1">
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
            Delete
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <span className="flex items-center">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move lesson ${lesson.title} up`} disabled={busy || first} onClick={() => onMove(-1)}>
            <ArrowUp aria-hidden="true" className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move lesson ${lesson.title} down`} disabled={busy || last} onClick={() => onMove(1)}>
            <ArrowDown aria-hidden="true" className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit lesson ${lesson.title}`} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete lesson ${lesson.title}`} onClick={() => setConfirmDelete(true)} className="text-danger">
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </span>
      )}
    </div>
  );
}
