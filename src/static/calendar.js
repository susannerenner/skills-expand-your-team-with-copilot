const ActivityCalendar = (() => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function minutes(time) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return null;
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  }

  function timeLabel(value) {
    const hours = Math.floor(value / 60) % 24;
    return `${hours % 12 || 12}:${String(value % 60).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  }

  // Each connected overlap group shares a width, with touching meetings in the same lane.
  function layoutEvents(events) {
    events.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));
    let group = [];
    let groupEnd = -1;
    let laneEnds = [];
    const finishGroup = () => {
      group.forEach((event) => { event.lanes = laneEnds.length; });
      group = [];
      laneEnds = [];
    };
    events.forEach((event) => {
      if (event.start >= groupEnd) finishGroup();
      let lane = laneEnds.findIndex((end) => end <= event.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = event.end;
      event.lane = lane;
      group.push(event);
      groupEnd = group.length === 1 ? event.end : Math.max(groupEnd, event.end);
    });
    finishGroup();
    return events;
  }

  function render(activities, { day, weekend, onSelect }) {
    const container = document.createElement("div");
    const help = document.createElement("p");
    help.className = "calendar-help";
    help.textContent = "Weekly schedule · Hover or focus for full details. Select an activity to open its card. Entries without an end time use a one-hour placeholder.";
    container.appendChild(help);

    const eventsByDay = days.map(() => []);
    const unscheduled = [];
    Object.entries(activities).forEach(([name, details]) => {
      const schedule = details.schedule_details;
      const start = minutes(schedule?.start_time);
      const end = schedule?.end_time ? minutes(schedule.end_time) : Math.min(start + 60, 1440);
      const meetingDays = [...new Set(schedule?.days || [])].filter((value) => days.includes(value));
      if (start === null || end === null || start === end || !meetingDays.length) {
        unscheduled.push(name);
        return;
      }
      meetingDays.forEach((meetingDay) => {
        const index = days.indexOf(meetingDay);
        eventsByDay[index].push({ name, details, start, end: end < start ? 1440 : end });
        if (end < start && end > 0) {
          eventsByDay[(index + 1) % 7].push({ name, details, start: 0, end });
        }
      });
    });

    eventsByDay.forEach((events, index) => {
      if ((day && day !== days[index]) || (weekend && index !== 0 && index !== 6)) {
        events.length = 0;
      }
    });
    const events = eventsByDay.flat();
    const firstMinute = Math.floor(Math.min(360, ...events.map((event) => event.start)) / 60) * 60;
    const lastMinute = Math.ceil(Math.max(1080, ...events.map((event) => event.end)) / 60) * 60;
    const scroller = document.createElement("div");
    scroller.className = "calendar-scroll";
    scroller.tabIndex = 0;
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "Weekly activity calendar, Sunday through Saturday");
    const grid = document.createElement("div");
    grid.className = "calendar-grid";
    const timeHeading = document.createElement("div");
    timeHeading.className = "calendar-heading";
    timeHeading.textContent = "Time";
    grid.appendChild(timeHeading);
    days.forEach((name) => {
      const heading = document.createElement("div");
      heading.className = "calendar-heading";
      heading.textContent = name;
      grid.appendChild(heading);
    });
    const axis = document.createElement("div");
    axis.className = "calendar-time-axis";
    axis.style.height = `${lastMinute - firstMinute}px`;
    for (let value = firstMinute; value <= lastMinute; value += 60) {
      const label = document.createElement("span");
      label.textContent = timeLabel(value);
      label.style.top = `${value - firstMinute}px`;
      axis.appendChild(label);
    }
    grid.appendChild(axis);

    const tooltip = document.createElement("div");
    tooltip.className = "calendar-tooltip hidden";
    tooltip.id = "calendar-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.tabIndex = 0;
    let hideTimer;
    const keepDetails = () => clearTimeout(hideTimer);
    const hideDetails = () => {
      keepDetails();
      tooltip.classList.add("hidden");
    };
    const hideDetailsSoon = () => {
      keepDetails();
      hideTimer = setTimeout(hideDetails, 150);
    };
    tooltip.addEventListener("mouseenter", keepDetails);
    tooltip.addEventListener("mouseleave", hideDetailsSoon);
    tooltip.addEventListener("focus", keepDetails);
    tooltip.addEventListener("blur", hideDetails);
    tooltip.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideDetails();
    });
    scroller.addEventListener("scroll", hideDetails);
    eventsByDay.forEach((dayEvents, index) => {
      const column = document.createElement("div");
      column.className = "calendar-day";
      column.setAttribute("aria-label", days[index]);
      column.style.height = `${lastMinute - firstMinute}px`;
      layoutEvents(dayEvents).forEach((event) => {
        const { name, details, start, end, lane, lanes } = event;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "calendar-event";
        button.style.top = `${start - firstMinute}px`;
        button.style.height = `${end - start}px`;
        button.style.left = `${lane * 100 / lanes}%`;
        button.style.width = `calc(${100 / lanes}% - 2px)`;
        button.textContent = `${name}\n${details.participants.length}/${details.max_participants} enrolled`;
        const schedule = details.schedule_details;
        const description = [
          name,
          details.description,
          `Schedule: ${schedule.days.join(", ")}, ${timeLabel(minutes(schedule.start_time))}${schedule.end_time ? ` – ${timeLabel(minutes(schedule.end_time))}` : " (end time not specified)"}`,
          details.difficulty ? `Difficulty: ${details.difficulty}` : "",
          `${details.participants.length}/${details.max_participants} enrolled`,
          `Participants: ${details.participants.join(", ") || "None"}`,
        ].filter(Boolean).join("\n");
        button.setAttribute("aria-label", `${name}, ${days[index]}, ${timeLabel(start)}. ${details.participants.length} of ${details.max_participants} enrolled. Open card.`);
        const showDetails = () => {
          keepDetails();
          tooltip.textContent = description;
          tooltip.classList.remove("hidden");
          button.setAttribute("aria-describedby", tooltip.id);
          const rect = button.getBoundingClientRect();
          const width = tooltip.offsetWidth;
          const height = tooltip.offsetHeight;
          tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
          tooltip.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - height - 8))}px`;
        };
        button.addEventListener("mouseenter", showDetails);
        button.addEventListener("focus", showDetails);
        button.addEventListener("mouseleave", hideDetailsSoon);
        button.addEventListener("blur", hideDetailsSoon);
        button.addEventListener("keydown", (event) => {
          if (event.key === "Escape") hideDetails();
        });
        button.addEventListener("click", () => onSelect(name));
        column.appendChild(button);
      });
      grid.appendChild(column);
    });
    scroller.appendChild(grid);
    container.append(scroller, tooltip);
    if (unscheduled.length) {
      const notice = document.createElement("p");
      notice.textContent = "Schedule unavailable (open card for details): ";
      unscheduled.forEach((name) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = name;
        button.addEventListener("click", () => onSelect(name));
        notice.appendChild(button);
      });
      container.appendChild(notice);
    }
    return container;
  }

  return { render };
})();
