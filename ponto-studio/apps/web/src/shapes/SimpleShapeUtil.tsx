import { Ellipse2d, Rectangle2d, SVGContainer, ShapeUtil, type TLOnResizeHandler } from "@tldraw/tldraw";
import { simpleShapeMigrations, simpleShapeProps, type SimpleShape } from "./SimpleShape.ts";

/**
 * Substituto customizado do `geo` nativo (retângulo/elipse) — criado porque o
 * `geo` só suporta a paleta de cores fixa do tldraw, nunca cor livre (hex
 * arbitrário), o mesmo problema que motivou o shape `vector-path` (a Caneta).
 * Geometria e interação de resize são 100% NATIVAS do tldraw (`Rectangle2d`/
 * `Ellipse2d`, `select.resizing` via a tool) — bem mais simples que a Caneta,
 * que precisou de handles de nó/âncora próprios.
 */
export class SimpleShapeUtil extends ShapeUtil<SimpleShape> {
  static override type = "simple-shape" as const;
  static override props = simpleShapeProps;
  static override migrations = simpleShapeMigrations;

  override getDefaultProps(): SimpleShape["props"] {
    return { kind: "rectangle", w: 200, h: 200, hasFill: true, hasStroke: true, strokeWidth: 2, color: "#7c5cbf" };
  }

  getGeometry(shape: SimpleShape) {
    const { kind, w, h, hasFill } = shape.props;
    if (kind === "ellipse") {
      return new Ellipse2d({ width: w, height: h, isFilled: hasFill });
    }
    return new Rectangle2d({ width: w, height: h, isFilled: hasFill });
  }

  component(shape: SimpleShape) {
    return (
      <SVGContainer id={shape.id}>
        <SimpleShapeSvg shape={shape} />
      </SVGContainer>
    );
  }

  indicator(shape: SimpleShape) {
    const { kind, w, h } = shape.props;
    return kind === "ellipse" ? (
      <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />
    ) : (
      <rect width={w} height={h} />
    );
  }

  override toSvg(shape: SimpleShape) {
    return <SimpleShapeSvg shape={shape} />;
  }

  override onResize: TLOnResizeHandler<SimpleShape> = (shape, info) => {
    const { scaleX, scaleY } = info;
    return {
      props: {
        w: Math.max(1, shape.props.w * scaleX),
        h: Math.max(1, shape.props.h * scaleY),
      },
    };
  };
}

function SimpleShapeSvg({ shape }: { shape: SimpleShape }) {
  const { kind, w, h, hasFill, hasStroke, strokeWidth, color } = shape.props;
  const fill = hasFill ? color : "none";
  const stroke = hasStroke ? color : "none";
  return kind === "ellipse" ? (
    <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  ) : (
    <rect width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  );
}
