// A template (unlike a layout) is re-created on every navigation, so each tab switch replays the
// quick slide-and-fade and the staggered cascade of its cards.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-flow cascade slide-in">{children}</div>;
}
