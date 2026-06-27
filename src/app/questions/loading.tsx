export default function QuestionsLoading() {
  return (
    <div className="board-page shell board-loading" aria-label="Loading questions" aria-busy="true">
      <div className="skeleton skeleton--heading" />
      <div className="skeleton skeleton--card" />
      <div className="skeleton skeleton--card" />
      <div className="skeleton skeleton--card" />
    </div>
  );
}
