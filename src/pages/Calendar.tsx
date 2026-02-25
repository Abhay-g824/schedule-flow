import { useState } from "react";
import { CalendarView } from "@/components/CalendarView";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { NavLink } from "react-router-dom";

const Calendar = () => {
  const { tasks, toggleTask } = useTasks();
  const navigate = useNavigate();

  return (
    <div className="h-full w-full">
      <CalendarView
        tasks={tasks}
        onToggle={toggleTask}
        onSelectDate={(date) => navigate(`/task/${format(date, "yyyy-MM-dd")}`)}
      />
    </div>
  );
};

export default Calendar;
