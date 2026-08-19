import { ClassicPreset } from "rete";
import type { GetSchemes } from "rete";
import type { ReactArea2D } from "rete-react-plugin";
import type { MinimapExtra } from "rete-minimap-plugin";
import type { ContextMenuExtra } from "rete-context-menu-plugin";

export const parentSocket = new ClassicPreset.Socket("parent");
export const childSocket = new ClassicPreset.Socket("child");
export const spouseSocket = new ClassicPreset.Socket("spouse");

export class PersonRete extends ClassicPreset.Node {
  width = 240;
  height = 90;
  personId: string;

  constructor(personId: string) {
    super("person");
    this.personId = personId;
    this.addInput("parent", new ClassicPreset.Input(parentSocket, "Parent", true));
    this.addOutput("child", new ClassicPreset.Output(childSocket, "Child", true));
    this.addInput("spouseIn", new ClassicPreset.Input(spouseSocket, "Spouse", true));
    this.addOutput("spouseOut", new ClassicPreset.Output(spouseSocket, "Spouse", true));
  }
}

export class GroupRete extends ClassicPreset.Node {
  width = 280;
  height = 180;
  groupId: string;

  constructor(groupId: string) {
    super("group");
    this.groupId = groupId;
  }
}

export type RTNode = PersonRete | GroupRete;

export type ConnectionKind = "parent" | "spouse";

export class RelConnection extends ClassicPreset.Connection<PersonRete, PersonRete> {
  relationshipId: string;
  kind: ConnectionKind;

  constructor(
    relationshipId: string,
    kind: ConnectionKind,
    source: PersonRete,
    sourceOutput: "child" | "spouseOut",
    target: PersonRete,
    targetInput: "parent" | "spouseIn",
  ) {
    super(source, sourceOutput, target, targetInput);
    this.relationshipId = relationshipId;
    this.kind = kind;
  }
}

export type Schemes = GetSchemes<RTNode, RelConnection>;
export type AreaExtra = ReactArea2D<Schemes> | MinimapExtra | ContextMenuExtra;

export const isPersonNode = (node: RTNode): node is PersonRete => node.label === "person";
export const isGroupNode = (node: RTNode): node is GroupRete => node.label === "group";
