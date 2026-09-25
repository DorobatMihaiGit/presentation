import { Texture } from "three";
import { describe, expect, it } from "vitest";
import { STACK_LAYERS } from "@/content/types";
import { createStackMaterials } from "@/experience/scenes/materials";
import { PCB_TRACE_PATH, traceRibbon } from "@/experience/scenes/pcb-traces";
import {
  LAYER_HEIGHT,
  STACK_GAP,
  STACK_HEIGHT,
  STACK_OBJECTS,
  stackLayout,
} from "@/experience/scenes/stack-layout";

describe("stackLayout (asset contract v1)", () => {
  it("names the layers layer_<stack layer>, base plate first", () => {
    expect(stackLayout().map((placement) => placement.name)).toEqual([
      "layer_craft",
      "layer_infra",
      "layer_data",
      "layer_api",
      "layer_interface",
    ]);
  });

  it("stacks from the ground up to 0.25 m, origins on bottom faces", () => {
    const layout = stackLayout();
    expect(layout[0].y).toBe(0);
    for (let i = 1; i < layout.length; i += 1) {
      expect(layout[i].y).toBeCloseTo(
        layout[i - 1].y + layout[i - 1].height + STACK_GAP,
      );
    }
    const top = layout[layout.length - 1];
    expect(top.y + top.height).toBeCloseTo(STACK_HEIGHT);
  });

  it("covers every stack_layer enum value exactly once", () => {
    expect(Object.keys(LAYER_HEIGHT).sort()).toEqual([...STACK_LAYERS].sort());
  });

  it("opens gaps between the layers when exploded, never below ground", () => {
    const closed = stackLayout(0);
    const open = stackLayout(1);
    expect(open[0].y).toBe(0);
    expect(open[4].y).toBeGreaterThan(closed[4].y + 0.4);
  });

  it("keeps the contract names of the extra objects", () => {
    expect(STACK_OBJECTS).toEqual({
      engraveHero: "engrave_hero",
      engraveContact: "engrave_contact",
      led: "led_status",
      pcbTraces: "pcb_traces",
    });
  });
});

describe("traceRibbon (pcb_traces)", () => {
  const ribbon = traceRibbon(PCB_TRACE_PATH, 0.004);
  const us = [...ribbon.uvs].filter((_, index) => index % 2 === 0);

  it("runs U from 0 to 1 along the trace, never backwards", () => {
    expect(Math.min(...us)).toBe(0);
    expect(Math.max(...us)).toBe(1);
    for (let segment = 0; segment < PCB_TRACE_PATH.length - 1; segment += 1) {
      const [start, , end] = us.slice(segment * 4, segment * 4 + 4);
      expect(end).toBeGreaterThan(start);
      if (segment > 0) {
        expect(start).toBeCloseTo(us[(segment - 1) * 4 + 2]);
      }
    }
  });

  it("stays on the PCB's top face and faces up", () => {
    const xs = [...ribbon.positions].filter((_, index) => index % 3 === 0);
    const ys = [...ribbon.positions].filter((_, index) => index % 3 === 1);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThan(0.2);
    expect(new Set(ys)).toEqual(new Set([0]));
    // First triangle: a negative (x, z) cross product means a +y normal.
    const [a, b, c] = [...ribbon.indices.slice(0, 3)].map((i) => [
      ribbon.positions[i * 3],
      ribbon.positions[i * 3 + 2],
    ]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    expect(cross).toBeLessThan(0);
  });
});

describe("createStackMaterials", () => {
  const textures = {
    pcb: new Texture(),
    etchHero: new Texture(),
    etchContact: new Texture(),
  };

  it("uses real glass (transmission) from tier 2", () => {
    const glass = createStackMaterials(2, textures).layers.interface;
    expect(glass.transmission).toBe(1);
    expect(glass.iridescence).toBe(1);
    expect(glass.transparent).toBe(false);
  });

  it("fakes the glass at tier 1 (no transmission pass)", () => {
    const glass = createStackMaterials(1, textures).layers.interface;
    expect(glass.transmission).toBe(0);
    expect(glass.transparent).toBe(true);
  });

  it("brushes the titanium and anodized base (anisotropy)", () => {
    const { layers } = createStackMaterials(2, textures);
    expect(layers.api.anisotropy).toBeGreaterThan(0);
    expect(layers.craft.anisotropy).toBeGreaterThan(0);
    expect(layers.infra.map).toBe(textures.pcb);
  });

  it("starts both etchings invisible", () => {
    const materials = createStackMaterials(2, textures);
    expect(materials.etchHero.opacity).toBe(0);
    expect(materials.etchContact.opacity).toBe(0);
  });
});
