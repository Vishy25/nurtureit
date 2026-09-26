import { Link } from "@tanstack/react-router";
import { Plus, UserPlus, CheckSquare, Kanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Floating quick-add button for phones and tablets. */
export function QuickActions() {
  return (
    <div className="fixed bottom-5 right-5 z-30 lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg" aria-label="Quick actions">
            <Plus className="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48">
          <DropdownMenuItem asChild><Link to="/leads"><UserPlus className="mr-2 size-4" />Add lead</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/tasks"><CheckSquare className="mr-2 size-4" />Add task</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/pipeline"><Kanban className="mr-2 size-4" />Open pipeline</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
