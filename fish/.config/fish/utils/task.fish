# Add a task to personal notes using opencode TaskAdder agent
function task-add
    set notes_dir /home/lewis/Workspaces/Personal/personal-notes

    # Check if notes directory exists
    if not test -d $notes_dir
        echo "Error: Notes directory not found at $notes_dir"
        return 1
    end

    # Check if gum is installed
    if not command -v gum >/dev/null 2>&1
        echo "Error: gum is not installed"
        return 1
    end

    # Check if opencode is installed
    if not command -v opencode >/dev/null 2>&1
        echo "Error: opencode is not installed"
        return 1
    end

    # Get task description
    set task_desc (gum input --placeholder "Enter task description...")

    # Exit if no task was entered
    if test -z "$task_desc"
        echo "No task entered, exiting."
        return 0
    end

    # Select priority using gum filter with icons
    set priority_display (printf '🔴 P1 - Critical\n🟠 P2 - High\n🟡 P3 - Medium\n🟢 P4 - Low\n' | gum filter --placeholder "Select priority...")

    # Extract priority level (p1, p2, p3, or p4) from selection
    set priority ""
    switch $priority_display
        case '🔴 P1 - Critical'
            set priority "p1"
        case '🟠 P2 - High'
            set priority "p2"
        case '🟡 P3 - Medium'
            set priority "p3"
        case '🟢 P4 - Low'
            set priority "p4"
    end

    # Exit if no priority was selected
    if test -z "$priority"
        echo "No priority selected, exiting."
        return 0
    end

    # Build list of available task files
    set task_files
    set task_labels

    # Add personal tasks
    if test -f $notes_dir/personal/tasks.md
        set -a task_files "$notes_dir/personal/tasks.md"
        set -a task_labels "Personal Tasks"
    end

    # Add personal project tasks
    if test -d $notes_dir/personal/tasks
        for project_dir in $notes_dir/personal/tasks/*/
            set project_name (basename $project_dir)
            if test -f $project_dir/tasks.md
                set -a task_files "$project_dir/tasks.md"
                set -a task_labels "Personal: $project_name"
            end
        end
    end

    # Add work tasks - main tasks.md
    if test -f $notes_dir/work/radicle/tasks.md
        set -a task_files "$notes_dir/work/radicle/tasks.md"
        set -a task_labels "Work: Radicle"
    end

    if test -f $notes_dir/work/telehealth/tasks.md
        set -a task_files "$notes_dir/work/telehealth/tasks.md"
        set -a task_labels "Work: Telehealth"
    end

    # Check if we have any task files
    if test (count $task_files) -eq 0
        echo "Error: No task files found"
        return 1
    end

    # Let user select which task file to add to
    set selected_label (printf '%s\n' $task_labels | gum filter --placeholder "Select task file...")

    # Exit if no selection was made
    if test -z "$selected_label"
        echo "No task file selected, exiting."
        return 0
    end

    # Find the corresponding file
    set selected_file ""
    for i in (seq (count $task_labels))
        if test "$task_labels[$i]" = "$selected_label"
            set selected_file $task_files[$i]
            break
        end
    end

    # Add the task using opencode TaskAdder agent
    if test -n "$selected_file"
        # Build the prompt for the TaskAdder agent
        set prompt "Add task to file: $selected_file
Task description: $task_desc
Priority: $priority"

        opencode run --agent 'TaskAdder' --model 'github-copilot/gpt-4.1' "$prompt"

        if test $status -eq 0
            echo "✓ Task added to $selected_label with priority: $priority_display"
        else
            echo "✗ Failed to add task"
            return 1
        end
    else
        echo "Error: Could not find selected file"
        return 1
    end
end
