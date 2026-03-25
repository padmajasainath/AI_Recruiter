'use client';

export default function ScoreCircle({ score }: { score: number | null }) {
    if (score === null) return null;
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <div className="score-circle" style={{ borderColor: color, color }}>
            {Math.round(score)}
        </div>
    );
}
