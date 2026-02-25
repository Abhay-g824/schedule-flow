import { useMemo } from "react";
import { Task } from "@/types/task";
import { calculateStreak, getWeeklyStats } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Target, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface ProductivityStatsProps {
    tasks: Task[];
}

export function ProductivityStats({ tasks }: ProductivityStatsProps) {
    const streak = useMemo(() => calculateStreak(tasks), [tasks]);
    const weeklyStats = useMemo(() => getWeeklyStats(tasks), [tasks]);

    // Calculate weekly completion rate
    const weeklyRate = useMemo(() => {
        const total = weeklyStats.reduce((acc, curr) => acc + curr.total, 0);
        const completed = weeklyStats.reduce((acc, curr) => acc + curr.completed, 0);
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }, [weeklyStats]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Streak Card */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-100 dark:from-orange-950/20 dark:to-orange-900/10 dark:border-orange-900/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        Current Streak
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {streak} Days
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Keep it burning!
                    </p>
                </CardContent>
            </Card>

            {/* Completion Rate Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 dark:from-blue-950/20 dark:to-blue-900/10 dark:border-blue-900/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        Weekly Focus
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {weeklyRate}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Completion rate (7 days)
                    </p>
                </CardContent>
            </Card>

            {/* Mini Chart Card */}
            <Card className="md:col-span-1 border-border/50">
                <CardContent className="p-4 h-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyStats}>
                            <XAxis
                                dataKey="date"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                            />
                            <Bar
                                dataKey="completed"
                                fill="hsl(var(--primary))"
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                                stackId="a"
                            />
                            <Bar
                                dataKey="total"
                                fill="hsl(var(--muted))"
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                                stackId="b" // Different stack ID to show side-by-side or total? 
                            // Actually let's just show completed height.
                            // If we want background total, we can do composed chart.
                            // For simplicity: Just showing "Completed" amount as bars.
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
