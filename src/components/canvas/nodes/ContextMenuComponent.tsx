interface Item {
  label: string;
  key: string;
  handler(): void | Promise<void>;
}

interface Props {
  data: {
    items: Item[];
    onHide(): void;
  };
}

const ContextMenuComponent = ({ data }: Props) => (
  <div
    className="min-w-[170px] bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1 overflow-hidden"
    onContextMenu={(e) => e.preventDefault()}
  >
    {data.items.length === 0 ? (
      <div className="px-3 py-1.5 text-xs text-muted-foreground italic">—</div>
    ) : (
      data.items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={() => {
            void item.handler();
            data.onHide();
          }}
        >
          {item.label}
        </button>
      ))
    )}
  </div>
);

export default ContextMenuComponent;
