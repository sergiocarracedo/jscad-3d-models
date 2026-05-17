const discoveredModules = import.meta.glob('./*.js', { eager: true })

const toTitleCase = (value) =>
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const toModelDefinition = ({
  modulePath,
  moduleExports,
  fallbackId,
  fallbackTitle,
}) => {
  if (!moduleExports?.main || typeof moduleExports.main !== 'function')
    return null

  return {
    id: moduleExports.id ?? fallbackId,
    title: moduleExports.title ?? fallbackTitle,
    exportFileName: moduleExports.exportFileName ?? `${fallbackId}.stl`,
    supportsIncludeGuides: Boolean(moduleExports.supportsIncludeGuides),
    main: moduleExports.main,
    modulePath,
  }
}

const stripModelPrefix = (path) => path.replace('./', '').replace(/\.js$/, '')

const modelStore = new Map()
const pathToId = new Map()

const registerModelModule = ({ modulePath, moduleExports }) => {
  const fallbackId = stripModelPrefix(modulePath)
  const fallbackTitle = toTitleCase(fallbackId)
  const definition = toModelDefinition({
    modulePath,
    moduleExports,
    fallbackId,
    fallbackTitle,
  })

  if (!definition) return

  const previousId = pathToId.get(modulePath)
  if (previousId && previousId !== definition.id) {
    modelStore.delete(previousId)
  }

  pathToId.set(modulePath, definition.id)
  modelStore.set(definition.id, definition)
}

const sortedPaths = Object.keys(discoveredModules).sort()
for (const modulePath of sortedPaths) {
  registerModelModule({
    modulePath,
    moduleExports: discoveredModules[modulePath],
  })
}

export const modelModulePaths = sortedPaths

export const upsertDiscoveredModel = (modulePath, moduleExports) => {
  registerModelModule({ modulePath, moduleExports })
}

export const getModelList = () =>
  Array.from(modelStore.values()).sort((a, b) => a.title.localeCompare(b.title))

export const getModelById = (modelId) => modelStore.get(modelId)

export const getDefaultModelId = () => {
  if (modelStore.has('xps-support')) return 'xps-support'
  const first = getModelList()[0]
  return first?.id ?? null
}
