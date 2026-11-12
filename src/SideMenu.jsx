import { Button, Checkbox, ComboBox, Input, Label, ListBox } from "@heroui/react";

export function SideMenu({
  model,
  models,
  status,
  onExport3mf,
  onExportStl,
  onResetCamera,
  onSelect,
  onParameterChange,
  parameters,
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="side-menu-eyebrow">OpenJSCAD</p>
        <h1 className="side-menu-title">{model?.title ?? "Model Viewer"}</h1>
        <p className="side-menu-description">
          Edit <code className="side-menu-code">src/models/{model?.id ?? "*.js"}.js</code> and the
          viewer updates in real time.
        </p>
      </div>

      <ComboBox
        selectedKey={model?.id ?? null}
        onSelectionChange={(key) => key && onSelect(String(key))}
      >
        <Label>Model</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Search models..." />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox>
            {models.map((item) => (
              <ListBox.Item id={item.id} key={item.id} textValue={item.title}>
                {item.title}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      {model?.parameters && (
        <fieldset className="side-menu-parameters">
          <legend>Variant</legend>
          {Object.entries(model.parameters).map(([key, definition]) => (
            <Checkbox
              id={`${model.id}-${key}`}
              isSelected={parameters[key]}
              key={key}
              onChange={(isSelected) => onParameterChange(key, isSelected)}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {definition.label}
              </Checkbox.Content>
            </Checkbox>
          ))}
        </fieldset>
      )}

      <div className="side-menu-help">
        <p>
          <strong>Orbit</strong>: drag
        </p>
        <p>
          <strong>Pan</strong>: middle mouse or shift + drag
        </p>
        <p>
          <strong>Zoom</strong>: mouse wheel
        </p>
      </div>

      <div className="grid gap-3">
        <Button fullWidth variant="primary" onPress={onExport3mf}>
          Export 3MF
        </Button>
        <Button fullWidth variant="secondary" onPress={onExportStl}>
          Export STL
        </Button>
        <Button fullWidth variant="secondary" onPress={onResetCamera}>
          Reset Camera
        </Button>
      </div>

      <pre className="side-menu-status">{status}</pre>
    </div>
  );
}
