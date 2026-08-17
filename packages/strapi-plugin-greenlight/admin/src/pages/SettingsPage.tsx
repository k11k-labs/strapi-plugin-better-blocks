import * as React from 'react';

import { useFetchClient, useNotification } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Field,
  Flex,
  IconButton,
  Loader,
  Main,
  MultiSelect,
  MultiSelectOption,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { ArrowDown, ArrowUp, Duplicate, Plus, Trash } from '@strapi/icons';

import { routes } from '../api';
import type { Stage, Workflow } from '../api';
import { primeCoverage } from '../coverage';

interface Role {
  id: number;
  name: string;
}
interface ContentTypeOption {
  uid: string;
  displayName: string;
}

type DraftStage = Partial<Stage> & { name: string; order: number };

const emptyStage = (order: number): DraftStage => ({
  name: 'New stage',
  order,
  color: '#4945FF',
  isTerminal: false,
  rolesCanMoveFrom: [],
  rolesCanMoveTo: [],
});

const StageEditor = ({
  stage,
  roles,
  isFirst,
  isLast,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  stage: DraftStage;
  roles: Role[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: DraftStage) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) => (
  <Box padding={4} background="neutral0" hasRadius shadow="tableShadow" marginBottom={3}>
    <Flex gap={3} alignItems="flex-end" wrap="wrap">
      <Box flex="1" minWidth="200px">
        <Field.Root name={`stage-name-${stage.order}`}>
          <Field.Label>Name</Field.Label>
          <TextInput
            value={stage.name}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ...stage, name: event.target.value })
            }
          />
        </Field.Root>
      </Box>

      <Box width="120px">
        <Field.Root name={`stage-color-${stage.order}`}>
          <Field.Label>Colour</Field.Label>
          <TextInput
            value={stage.color ?? '#4945FF'}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ...stage, color: event.target.value })
            }
          />
        </Field.Root>
      </Box>

      <Flex gap={1} paddingBottom={1}>
        <IconButton label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>
        <IconButton label="Move down" disabled={isLast} onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>
        <IconButton label="Duplicate this stage with its permissions" onClick={onDuplicate}>
          <Duplicate />
        </IconButton>
        <IconButton label="Remove" onClick={onRemove}>
          <Trash />
        </IconButton>
      </Flex>
    </Flex>

    <Box paddingTop={3}>
      <Checkbox
        checked={stage.isTerminal ?? false}
        onCheckedChange={(checked: boolean) => onChange({ ...stage, isTerminal: checked })}
      >
        Approved stage — documents can only be published from here
      </Checkbox>
    </Box>

    <Flex gap={4} paddingTop={3} wrap="wrap">
      <Box flex="1" minWidth="240px">
        <Field.Root
          name={`from-${stage.order}`}
          hint="Empty means anyone with access to the plugin."
        >
          <Field.Label>Roles that can move a document OUT of this stage</Field.Label>
          <MultiSelect
            value={(stage.rolesCanMoveFrom ?? []).map(String)}
            onChange={(values: string[]) =>
              onChange({ ...stage, rolesCanMoveFrom: values.map(Number) })
            }
          >
            {roles.map((role) => (
              <MultiSelectOption key={role.id} value={String(role.id)}>
                {role.name}
              </MultiSelectOption>
            ))}
          </MultiSelect>
          <Field.Hint />
        </Field.Root>
      </Box>

      <Box flex="1" minWidth="240px">
        <Field.Root name={`to-${stage.order}`} hint="Empty means anyone with access to the plugin.">
          <Field.Label>Roles that can move a document INTO this stage</Field.Label>
          <MultiSelect
            value={(stage.rolesCanMoveTo ?? []).map(String)}
            onChange={(values: string[]) =>
              onChange({ ...stage, rolesCanMoveTo: values.map(Number) })
            }
          >
            {roles.map((role) => (
              <MultiSelectOption key={role.id} value={String(role.id)}>
                {role.name}
              </MultiSelectOption>
            ))}
          </MultiSelect>
          <Field.Hint />
        </Field.Root>
      </Box>
    </Flex>
  </Box>
);

export const SettingsPage = () => {
  const { get, post, put, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [contentTypes, setContentTypes] = React.useState<ContentTypeOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<{
    name: string;
    contentTypes: string[];
    enforcePublishGate: boolean;
    onMissingAssignment: 'firstStage' | 'allow';
    stages: DraftStage[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [wf, rolesRes, ctRes] = await Promise.all([
        get<{ workflows: Workflow[] }>(routes.workflows),
        get<{ roles: Role[] }>(routes.roles),
        get<{ contentTypes: ContentTypeOption[] }>(routes.contentTypes),
      ]);
      setWorkflows(wf.data.workflows);
      setRoles(rolesRes.data.roles);
      setContentTypes(ctRes.data.contentTypes);
      if (wf.data.workflows.length > 0 && selectedId === null) {
        setSelectedId(wf.data.workflows[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [get, selectedId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const current = workflows.find((workflow) => workflow.id === selectedId);
    if (!current) return;
    setDraft({
      name: current.name,
      contentTypes: current.contentTypes ?? [],
      enforcePublishGate: current.enforcePublishGate,
      onMissingAssignment: current.onMissingAssignment,
      stages: current.stages.map((stage) => ({ ...stage })),
    });
  }, [workflows, selectedId]);

  const notify = (type: 'success' | 'danger', message: string) =>
    toggleNotification({ type, message });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        ...draft,
        stages: draft.stages.map((stage, index) => ({ ...stage, order: index })),
      };
      if (selectedId) {
        await put(routes.workflow(selectedId), body);
      } else {
        const { data } = await post<{ workflow: Workflow }>(routes.workflows, body);
        setSelectedId(data.workflow.id);
      }
      notify('success', 'Workflow saved');
      // The list view's column and filter decide whether to exist from a cached
      // copy of this. Saving is the moment it goes stale.
      await primeCoverage({ force: true });
      await reload();
    } catch (error: any) {
      notify('danger', error?.response?.data?.error?.message ?? 'Could not save the workflow');
    } finally {
      setSaving(false);
    }
  };

  const createNew = () => {
    setSelectedId(null);
    setDraft({
      name: 'New workflow',
      contentTypes: [],
      enforcePublishGate: true,
      onMissingAssignment: 'firstStage',
      stages: [
        { ...emptyStage(0), name: 'Draft' },
        { ...emptyStage(1), name: 'In review' },
        { ...emptyStage(2), name: 'Approved', isTerminal: true },
      ],
    });
  };

  const remove = async () => {
    if (!selectedId) return;
    try {
      await del(routes.workflow(selectedId));
      setSelectedId(null);
      notify('success', 'Workflow deleted');
      await primeCoverage({ force: true });
      await reload();
    } catch (error: any) {
      notify('danger', error?.response?.data?.error?.message ?? 'Could not delete the workflow');
    }
  };

  const updateStage = (index: number, next: DraftStage) => {
    if (!draft) return;
    const stages = [...draft.stages];
    // Exactly one terminal stage, kept true as you click rather than only at save.
    if (next.isTerminal) stages.forEach((stage) => (stage.isTerminal = false));
    stages[index] = next;
    setDraft({ ...draft, stages });
  };

  /** "Apply to every stage", per list, because six stages by hand is a chore. */
  const applyToAll = (key: 'rolesCanMoveFrom' | 'rolesCanMoveTo', index: number) => {
    if (!draft) return;
    const value = draft.stages[index][key] ?? [];
    setDraft({ ...draft, stages: draft.stages.map((stage) => ({ ...stage, [key]: [...value] })) });
  };

  if (loading) {
    return (
      <Flex justifyContent="center" padding={10}>
        <Loader>Loading</Loader>
      </Flex>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
          <Box>
            <Typography variant="alpha" tag="h1">
              Greenlight
            </Typography>
            <Typography textColor="neutral600">
              Review stages, and who may move a document between them.
            </Typography>
          </Box>
          <Flex gap={2}>
            <Button variant="secondary" startIcon={<Plus />} onClick={createNew}>
              New workflow
            </Button>
            <Button loading={saving} onClick={save} disabled={!draft}>
              Save
            </Button>
          </Flex>
        </Flex>

        <Divider />

        <Box paddingTop={4} paddingBottom={4}>
          <Flex gap={4} wrap="wrap">
            <Box minWidth="220px">
              <Field.Root name="workflow-picker">
                <Field.Label>Workflow</Field.Label>
                <SingleSelect
                  value={selectedId ? String(selectedId) : 'new'}
                  onChange={(value: string | number) =>
                    value === 'new' ? createNew() : setSelectedId(Number(value))
                  }
                >
                  {workflows.map((workflow) => (
                    <SingleSelectOption key={workflow.id} value={String(workflow.id)}>
                      {workflow.name}
                    </SingleSelectOption>
                  ))}
                  <SingleSelectOption value="new">— new —</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            </Box>

            {selectedId ? (
              <Flex alignItems="flex-end">
                <Button variant="danger-light" startIcon={<Trash />} onClick={remove}>
                  Delete
                </Button>
              </Flex>
            ) : null}
          </Flex>
        </Box>

        {draft ? (
          <>
            <Flex gap={4} wrap="wrap" paddingBottom={4}>
              <Box flex="1" minWidth="240px">
                <Field.Root name="workflow-name">
                  <Field.Label>Name</Field.Label>
                  <TextInput
                    value={draft.name}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </Field.Root>
              </Box>

              <Box flex="1" minWidth="240px">
                <Field.Root
                  name="workflow-content-types"
                  hint="Only types with Draft & Publish appear — there is nothing to gate otherwise."
                >
                  <Field.Label>Content types under this workflow</Field.Label>
                  <MultiSelect
                    value={draft.contentTypes}
                    onChange={(values: string[]) => setDraft({ ...draft, contentTypes: values })}
                  >
                    {contentTypes.map((option) => (
                      <MultiSelectOption key={option.uid} value={option.uid}>
                        {option.displayName}
                      </MultiSelectOption>
                    ))}
                  </MultiSelect>
                  <Field.Hint />
                </Field.Root>
              </Box>
            </Flex>

            <Flex gap={4} wrap="wrap" paddingBottom={4}>
              <Box>
                <Checkbox
                  checked={draft.enforcePublishGate}
                  onCheckedChange={(checked: boolean) =>
                    setDraft({ ...draft, enforcePublishGate: checked })
                  }
                >
                  Block publishing outside the approved stage
                </Checkbox>
                <Typography variant="pi" textColor="neutral600" display="block">
                  Turn this off to use the stages as a status board only.
                </Typography>
              </Box>

              <Box minWidth="260px">
                <Field.Root name="on-missing">
                  <Field.Label>Documents created before this workflow</Field.Label>
                  <SingleSelect
                    value={draft.onMissingAssignment}
                    onChange={(value: string | number) =>
                      setDraft({ ...draft, onMissingAssignment: value as 'firstStage' | 'allow' })
                    }
                  >
                    <SingleSelectOption value="firstStage">
                      Put in the first stage, and block
                    </SingleSelectOption>
                    <SingleSelectOption value="allow">Let them publish</SingleSelectOption>
                  </SingleSelect>
                </Field.Root>
              </Box>
            </Flex>

            <Typography variant="delta" tag="h2">
              Stages
            </Typography>
            <Box paddingTop={3}>
              {draft.stages.map((stage, index) => (
                <React.Fragment key={index}>
                  <StageEditor
                    stage={stage}
                    roles={roles}
                    isFirst={index === 0}
                    isLast={index === draft.stages.length - 1}
                    onChange={(next) => updateStage(index, next)}
                    onMove={(direction) => {
                      const stages = [...draft.stages];
                      const target = index + direction;
                      if (target < 0 || target >= stages.length) return;
                      [stages[index], stages[target]] = [stages[target], stages[index]];
                      setDraft({ ...draft, stages });
                    }}
                    onDuplicate={() => {
                      const stages = [...draft.stages];
                      // With its permissions — copying six role lists by hand is
                      // the reason people give up on configuring this.
                      stages.splice(index + 1, 0, {
                        ...stage,
                        id: undefined,
                        name: `${stage.name} copy`,
                        isTerminal: false,
                      });
                      setDraft({ ...draft, stages });
                    }}
                    onRemove={() => {
                      const stages = draft.stages.filter((_, i) => i !== index);
                      setDraft({ ...draft, stages });
                    }}
                  />
                  <Flex gap={2} paddingBottom={3}>
                    <Button
                      size="S"
                      variant="tertiary"
                      onClick={() => applyToAll('rolesCanMoveFrom', index)}
                    >
                      Apply “out” roles to every stage
                    </Button>
                    <Button
                      size="S"
                      variant="tertiary"
                      onClick={() => applyToAll('rolesCanMoveTo', index)}
                    >
                      Apply “in” roles to every stage
                    </Button>
                  </Flex>
                </React.Fragment>
              ))}

              <Button
                variant="secondary"
                startIcon={<Plus />}
                onClick={() =>
                  setDraft({ ...draft, stages: [...draft.stages, emptyStage(draft.stages.length)] })
                }
              >
                Add a stage
              </Button>
            </Box>
          </>
        ) : (
          <Typography textColor="neutral600">
            No workflow yet. Create one to start gating a content type.
          </Typography>
        )}
      </Box>
    </Main>
  );
};

export default SettingsPage;
