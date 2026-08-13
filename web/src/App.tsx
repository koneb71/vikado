import { EditorLayout } from '@/editor/EditorLayout'
import { ProjectList } from '@/projects/ProjectList'
import { useProjectStore } from '@/state/projectStore'

export default function App() {
  const hasProject = useProjectStore((s) => s.project !== null)
  return hasProject ? <EditorLayout /> : <ProjectList />
}
