import React, { useState, useEffect } from 'react';
import { TaskEntry, ProjectInfo, TaskCategory, AppUser, APP_USERS, encryptPassword, decryptPassword } from './types';
import { INITIAL_PROJECTS, INITIAL_TASKS } from './initialData';
import CalendarView from './components/CalendarView';
import SheetView from './components/SheetView';
import DashboardView from './components/DashboardView';
import UserManagementView from './components/UserManagementView';
import {
  Calendar,
  Layers,
  Database,
  Briefcase,
  User,
  Users,
  RotateCcw,
  Plus,
  Compass,
  LayoutDashboard
} from 'lucide-react';

export default function App() {
  // Navigation tabs: 'calendar' | 'sheet' | 'dashboard' | 'users'
  const [activeTab, setActiveTab] = useState<'calendar' | 'sheet' | 'dashboard' | 'users'>('calendar');

  // Load categoryLabels and presets from localStorage or fallbacks
  const [categoryLabels, setCategoryLabels] = useState<Record<TaskCategory, string>>(() => {
    try {
      const saved = localStorage.getItem('op_hub_category_labels');
      return saved ? JSON.parse(saved) : {
        PROJECT_TRACK: 'Project Tracking & Execution',
        SALES_SUPPORT: 'Sales Person Requests',
        ONLINE_SUPPORT: 'Online Support',
        LICENSE_TRANSFER: 'Siemens License Transfer',
        CUSTOMER_EMAIL: 'Customer Email Support',
        OTHER: 'Other Office Tasks',
      };
    } catch {
      return {
        PROJECT_TRACK: 'Project Tracking & Execution',
        SALES_SUPPORT: 'Sales Person Requests',
        ONLINE_SUPPORT: 'Online Support',
        LICENSE_TRANSFER: 'Siemens License Transfer',
        CUSTOMER_EMAIL: 'Customer Email Support',
        OTHER: 'Other Office Tasks',
      };
    }
  });

  const [presets, setPresets] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('op_hub_quick_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return [
      {
        id: 'preset_1',
        label: 'Siemens License Transfer',
        emoji: '🔑',
        project: 'Office Work',
        category: 'LICENSE_TRANSFER',
        description: 'Processed Siemens License alignment check & ALM transfer request resolving client field query.',
        timeSpent: 1.5,
      },
      {
        id: 'preset_2',
        label: 'Reply to Sales Query',
        emoji: '💬',
        project: 'General Support',
        category: 'SALES_SUPPORT',
        description: 'Drafted technical specifications & bill of material quote response for client automation RFQ.',
        timeSpent: 2.0,
      },
      {
        id: 'preset_3',
        label: 'Tier-3 Email Support',
        emoji: '📧',
        project: 'Office Work',
        category: 'CUSTOMER_EMAIL',
        description: 'Resolved customer email queue inquiries concerning field upgrades and software versions.',
        timeSpent: 1.5,
      }
    ];
  });

  const handleUpdateCategoryLabels = (updated: Record<TaskCategory, string>) => {
    setCategoryLabels(updated);
    localStorage.setItem('op_hub_category_labels', JSON.stringify(updated));
  };

  const handleUpdatePresets = (updated: any[]) => {
    setPresets(updated);
    localStorage.setItem('op_hub_quick_presets', JSON.stringify(updated));
  };

  // Load state from localStorage on startup or fallback to initial hardcoded logs
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  }); // Current Date

  // Stateful list of users
  const [usersList, setUsersList] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('op_hub_users_list');
      return saved ? JSON.parse(saved) : APP_USERS;
    } catch {
      return APP_USERS;
    }
  });

  // Auth States
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const savedUser = localStorage.getItem('op_hub_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });


  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Google Sheets DB synchronization states
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('op_hub_sheet_url') || '';
    } catch {
      return '';
    }
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('op_hub_last_sync_time');
    } catch {
      return null;
    }
  });

  const fetchFromGoogleSheet = async (url: string) => {
    if (!url) return;
    setSyncStatus('syncing');
    try {
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const response = await fetch(fetchUrl);
      const data = await response.json();
      if (data.success) {
        const remoteTasks = data.tasks || [];
        const remoteProjects = data.projects || [];
        setTasks(remoteTasks);
        setProjects(remoteProjects);
        try {
          localStorage.setItem('engineer_tasks', JSON.stringify(remoteTasks));
          localStorage.setItem('engineer_projects', JSON.stringify(remoteProjects));
        } catch {}
        
        const nowStr = new Date().toLocaleTimeString();
        setLastSyncTime(nowStr);
        try {
          localStorage.setItem('op_hub_last_sync_time', nowStr);
        } catch {}
        setSyncStatus('success');
      } else {
        console.error('Fetch Google Sheet error:', data.error);
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Fetch Google Sheet failed:', err);
      setSyncStatus('error');
    }
  };

  const syncToGoogleSheet = async (url: string, updatedTasks: TaskEntry[], updatedProjects: ProjectInfo[]) => {
    if (!url) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'save_all',
          tasks: updatedTasks,
          projects: updatedProjects,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const nowStr = new Date().toLocaleTimeString();
        setLastSyncTime(nowStr);
        try {
          localStorage.setItem('op_hub_last_sync_time', nowStr);
        } catch {}
        setSyncStatus('success');
      } else {
        console.error('Sync Google Sheet error:', data.error);
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Sync Google Sheet failed:', err);
      setSyncStatus('error');
    }
  };

  // Save changes to localstorage on any update
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('engineer_tasks');
      const savedProjects = localStorage.getItem('engineer_projects');

      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else {
        setTasks(INITIAL_TASKS);
      }

      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      } else {
        setProjects(INITIAL_PROJECTS);
      }

      const savedUrl = localStorage.getItem('op_hub_sheet_url');
      if (savedUrl) {
        fetchFromGoogleSheet(savedUrl);
      }
    } catch (e) {
      console.warn('LocalStorage error: ', e);
      setTasks(INITIAL_TASKS);
      setProjects(INITIAL_PROJECTS);
    }
  }, []);

  const saveToStorage = (updatedTasks: TaskEntry[], updatedProjects: ProjectInfo[]) => {
    try {
      localStorage.setItem('engineer_tasks', JSON.stringify(updatedTasks));
      localStorage.setItem('engineer_projects', JSON.stringify(updatedProjects));

      const savedUrl = localStorage.getItem('op_hub_sheet_url');
      if (savedUrl) {
        syncToGoogleSheet(savedUrl, updatedTasks, updatedProjects);
      }
    } catch (e) {
      console.warn('LocalStorage save failed: ', e);
    }
  };

  // State handlers
  const handleAddTask = (newTask: Omit<TaskEntry, 'id'>) => {
    const defaultLogAuthor = currentUser?.role === 'engineer'
      ? currentUser.name
      : (managerFilterEngineer !== 'ALL' ? managerFilterEngineer : 'Balarathu');

    const freshTask: TaskEntry = {
      ...newTask,
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      engineer: newTask.engineer || defaultLogAuthor
    };
    const updated = [freshTask, ...tasks];
    setTasks(updated);
    saveToStorage(updated, projects);
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    // Look up in our stateful usersList
    const matched = usersList.find(
      (u) => u.username.toLowerCase() === loginUsername.trim().toLowerCase()
    );
    
    if (!matched) {
      setErrorMsg('User not found. Try as admin, manager, or balarathu.');
      return;
    }
    
    // Custom set passcode support
    const storedPw = localStorage.getItem(`pw_${matched.username}`);
    const expectedPassword = decryptPassword(storedPw, `${matched.username}123`);
    if (loginPassword !== expectedPassword) {
      setErrorMsg(`Incorrect passcode. Check staff records or try the default user passcode.`);
      return;
    }
    
    setCurrentUser(matched);
    localStorage.setItem('op_hub_user', JSON.stringify(matched));
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('op_hub_user');
  };

  // User list manipulation
  const handleUpdateUser = (username: string, updated: AppUser) => {
    const updatedUsers = usersList.map((u) => u.username === username ? updated : u);
    setUsersList(updatedUsers);
    localStorage.setItem('op_hub_users_list', JSON.stringify(updatedUsers));
  };

  const handleAddUser = (newUser: AppUser) => {
    const updatedUsers = [...usersList, newUser];
    setUsersList(updatedUsers);
    localStorage.setItem('op_hub_users_list', JSON.stringify(updatedUsers));
  };

  const handleDeleteUser = (username: string) => {
    const updatedUsers = usersList.filter((u) => u.username !== username);
    setUsersList(updatedUsers);
    localStorage.setItem('op_hub_users_list', JSON.stringify(updatedUsers));
  };

  const handleUpdateCurrentUser = (updated: AppUser) => {
    setCurrentUser(updated);
    localStorage.setItem('op_hub_user', JSON.stringify(updated));
    handleUpdateUser(updated.username, updated);
  };

  const handleUpdateTask = (updatedTask: TaskEntry) => {
    const updated = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    setTasks(updated);
    saveToStorage(updated, projects);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    saveToStorage(updated, projects);
  };

  const handleBulkImport = (importedTasks: TaskEntry[]) => {
    const updated = [...importedTasks, ...tasks];
    setTasks(updated);
    saveToStorage(updated, projects);
  };

  // Projects management
  const handleAddProject = (newProj: ProjectInfo) => {
    // Check if duplicate name
    if (projects.some((p) => p.name.toLowerCase() === newProj.name.toLowerCase())) {
      alert('A project with this name already exists.');
      return;
    }
    const updated = [...projects, newProj];
    setProjects(updated);
    saveToStorage(tasks, updated);
  };

  const handleDeleteProject = (name: string) => {
    const updated = projects.filter((p) => p.name !== name);
    setProjects(updated);
    saveToStorage(tasks, updated);
  };

  const handleUpdateProjectStatus = (name: string, status: ProjectInfo['status']) => {
    const updated = projects.map((p) => (p.name === name ? { ...p, status } : p));
    setProjects(updated);
    saveToStorage(tasks, updated);
  };

  const handleUpdateProject = (oldName: string, updatedProj: ProjectInfo) => {
    const nameChanged = oldName !== updatedProj.name;
    const updatedProjects = projects.map((p) => p.name === oldName ? updatedProj : p);
    let updatedTasks = tasks;
    if (nameChanged) {
      updatedTasks = tasks.map((t) => t.project === oldName ? { ...t, project: updatedProj.name } : t);
      setTasks(updatedTasks);
    }
    setProjects(updatedProjects);
    saveToStorage(updatedTasks, updatedProjects);
  };

  // Manager global filter for tracking and managing user logs & data
  const [managerFilterEngineer, setManagerFilterEngineer] = useState<string>('ALL');

  // Reset filter when current user changes or on logout
  useEffect(() => {
    setManagerFilterEngineer('ALL');
  }, [currentUser]);

  // Extract plain string list of unique project names for dropdown consumption
  const projectNames = projects.map((p) => p.name);

  // Filter out tasks of completed projects from the log lists
  const completedProjectNames = projects
    .filter((p) => p.status === 'Completed')
    .map((p) => p.name);

  // We exclude completed projects' tasks for logs as requested: "if the project is completed don't show that in the log"
  const activeTasksForLogs = tasks.filter((t) => !completedProjectNames.includes(t.project));

  // Filter active tasks for logs by role and manager selection
  const visibleTasksForLogs = activeTasksForLogs.filter((t) => {
    if (!currentUser) return false;
    if (currentUser.role === 'engineer') {
      return (t.engineer || 'Balarathu') === currentUser.name;
    }
    // For manager or admin: filter by selection
    if (managerFilterEngineer !== 'ALL') {
      return (t.engineer || 'Balarathu') === managerFilterEngineer;
    }
    return true;
  });

  // Similarly filter projects for Dashboard / dropdowns
  const visibleProjects = projects.filter((p) => {
    if (!currentUser) return false;
    if (currentUser.role === 'manager' || currentUser.role === 'admin') return true;
    // Otherwise, check if assigned
    return p.assignedEngineers?.includes(currentUser.name);
  });

  // Active projects for creating new tasks (non-completed and assigned to the user)
  const activeProjectsForUser = projects.filter((p) => {
    if (p.status === 'Completed') return false;
    if (!currentUser) return false;
    if (currentUser.role === 'manager' || currentUser.role === 'admin') return true;
    return p.assignedEngineers?.includes(currentUser.name);
  });

  const activeProjectNamesForDropdown = activeProjectsForUser.map((p) => p.name);

  // Unfiltered tasks list (for stats / dashboard) styled by user role & global filter
  const dashboardTasks = tasks.filter((t) => {
    if (!currentUser) return false;
    if (currentUser.role === 'engineer') {
      return (t.engineer || 'Balarathu') === currentUser.name;
    }
    if (managerFilterEngineer !== 'ALL') {
      return (t.engineer || 'Balarathu') === managerFilterEngineer;
    }
    return true;
  });

  // Also filter dropdown projects lists so users can't select completed projects when creating new tasks
  const activeProjectNames = projects
    .filter((p) => p.status !== 'Completed')
    .map((p) => p.name);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 sm:p-6 font-sans select-none antialiased selection:bg-indigo-500 selection:text-white">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-indigo-950 p-7 text-white text-center">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Engineers Project Hub</h1>
            <p className="text-[11px] text-indigo-200/80 mt-1 uppercase tracking-widest font-semibold">User Access Control Portal</p>
          </div>
          
          <div className="p-6 sm:p-8 space-y-6">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs py-2.5 px-3 rounded-lg flex items-center gap-2">
                <span className="font-bold">Error:</span> {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Username</label>
                <input
                  type="text"
                  required
                  placeholder="manager, admin"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full mt-1.5 bg-slate-50 border border-slate-250 text-sm rounded-xl p-2.5 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full mt-1.5 bg-slate-50 border border-slate-250 text-sm rounded-xl p-2.5 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-2.5 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Sign In to Hub
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="app_frame" className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white p-4 sm:p-6">
      {/* Top Professional Header Bar */}
      <header id="main_header_bar" className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
        
        {/* Logo / Badge section */}
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Engineers Project Hub</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Engineers Project Tracker</p>
          </div>
        </div>

        {/* Tab Navigation Segmented Selector - Exact matching theme aesthetics */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-center">
          <button
            id="tab_calendar"
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            Calendar View
          </button>
          <button
            id="tab_sheet"
            onClick={() => setActiveTab('sheet')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sheet'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            Spreadsheet
          </button>
          <button
            id="tab_dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            Analytics & Projects
          </button>
          <button
            id="tab_users"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            {currentUser.role === 'engineer' ? 'My Profile' : 'Staff Directory'}
          </button>
        </div>


        {/* Engineer Profile & Switch segment */}
        <div className="flex items-center space-x-3 self-end md:self-auto justify-between w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center uppercase shadow-sm border border-indigo-700">
              {currentUser.avatarInitials}
            </div>
            <div className="text-left leading-none">
              <span className="text-xs font-bold text-slate-800 block">{currentUser.name}</span>
              <span className="text-[10px] text-slate-500">{currentUser.designation}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-rose-600 text-[11px] font-bold transition cursor-pointer"
              title="Sign Out Current User"
            >
              Sign Out
            </button>

          </div>
        </div>
      </header>

      {currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin') && (
        <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-950">Manager Command Center</h3>
              <p className="text-xs text-indigo-700 mt-0.5">Filter, track, and manage all assigned project engineers and their daily task logs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-900 whitespace-nowrap">Filter Engineer:</span>
            <select
              value={managerFilterEngineer}
              onChange={(e) => setManagerFilterEngineer(e.target.value)}
              className="bg-white border border-indigo-200 text-xs rounded-xl p-2 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm cursor-pointer min-w-[180px]"
            >
              <option value="ALL">Show All Engineers (Mixed)</option>
              {usersList.map((user) => (
                <option key={user.username} value={user.name}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
            {managerFilterEngineer !== 'ALL' && (
              <button
                onClick={() => setManagerFilterEngineer('ALL')}
                className="text-xs text-indigo-650 hover:text-indigo-850 font-bold underline px-1.5 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Responsive Grid Layout containing Sidebar + Active Workspace */}
      <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0 items-start">
        
        {/* Operations Sidebar */}
        <aside className="w-full lg:w-72 flex flex-col space-y-6 shrink-0">
          
          {/* Workload Intensity with Dynamic Computations from User Tasks */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 w-full">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Workload Intensity</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-bold">Live</span>
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Siemens WinCC Upgrade</span>
                  <span className="text-indigo-600 font-bold">85%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: '85%' }}></div>
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Customer Support Tasks</span>
                  <span className="text-emerald-500 font-bold">42%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: '42%' }}></div>
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Office Routine</span>
                  <span className="text-amber-500 font-bold">58%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: '58%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Indigo Quick actions styled exact to template -> Made functionally active! */}
          {currentUser.role !== 'manager' && (
            <div className="bg-indigo-950 rounded-xl p-5 shadow-lg text-white w-full">
              <h2 className="text-sm font-bold mb-3 opacity-95">Quick Log Presets</h2>
              <p className="text-[10px] text-indigo-200 opacity-80 mb-3">Click to instantly log an operation as {currentUser.name}</p>
              <ul className="space-y-2 text-xs font-medium">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      onClick={() => handleAddTask({
                        date: selectedDate,
                        project: preset.project || 'Office Work',
                        category: preset.category || 'OTHER',
                        description: preset.description,
                        status: 'Completed',
                        timeSpent: preset.timeSpent || 1.5,
                        completedDate: selectedDate
                      })}
                      className="w-full flex items-center p-2 rounded bg-white/10 hover:bg-white/20 transition text-left cursor-pointer"
                    >
                      <span className="mr-3">{preset.emoji || '🔑'}</span>
                      <div className="flex-1 truncate">
                        <span className="block font-semibold truncate">{preset.label}</span>
                        <span className="text-[9px] text-indigo-300 block leading-tight truncate">{preset.project} • {preset.timeSpent}h • {categoryLabels[preset.category as TaskCategory] || preset.category}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Status Summary Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 w-full animate-fade-in">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Status Overview</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                <span className="text-slate-500">In Progress Tasks</span>
                <span className="font-bold text-slate-800 font-mono">{dashboardTasks.filter(t => t.status === 'In Progress').length} Tasks</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                <span className="text-slate-500">Completed Total</span>
                <span className="font-bold text-emerald-600 font-mono">{dashboardTasks.filter(t => t.status === 'Completed').length} Total</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Active Projects</span>
                <span className="font-bold text-indigo-600 underline font-mono">
                  {visibleProjects.filter(p => p.status !== 'Completed').length} Projects
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic active tab workspace block */}
        <div className="flex-1 w-full min-w-0">
          {activeTab === 'calendar' && (
            <CalendarView
              tasks={visibleTasksForLogs}
              projects={activeProjectNamesForDropdown}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              currentUser={currentUser}
              categoryLabels={categoryLabels}
              usersList={usersList}
            />
          )}

          {activeTab === 'sheet' && (
            <SheetView
              tasks={visibleTasksForLogs}
              projects={activeProjectNamesForDropdown}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onBulkImport={handleBulkImport}
              currentUser={currentUser}
              categoryLabels={categoryLabels}
              usersList={usersList}
              sheetUrl={sheetUrl}
              setSheetUrl={setSheetUrl}
              syncStatus={syncStatus}
              lastSyncTime={lastSyncTime}
              onFetchFromGoogleSheet={() => fetchFromGoogleSheet(sheetUrl)}
              onSyncToGoogleSheet={() => syncToGoogleSheet(sheetUrl, tasks, projects)}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              tasks={dashboardTasks}
              projects={visibleProjects}
              onAddProject={handleAddProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProjectStatus={handleUpdateProjectStatus}
              onUpdateProject={handleUpdateProject}
              currentUser={currentUser}
              categoryLabels={categoryLabels}
              usersList={usersList}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementView
              currentUser={currentUser}
              usersList={usersList}
              tasks={tasks}
              projects={projects}
              onUpdateUser={handleUpdateUser}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onUpdateCurrentUser={handleUpdateCurrentUser}
              categoryLabels={categoryLabels}
              presets={presets}
              onUpdateCategoryLabels={handleUpdateCategoryLabels}
              onUpdatePresets={handleUpdatePresets}
            />
          )}
        </div>
      </div>

      {/* Dynamic clean professional footer */}
      <footer id="workspace_footer" className="mt-8 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-5 text-xs text-slate-400 gap-4">
        <div>
          Engineers Project Hub © 2026 — Logged as <span className="font-semibold text-slate-600">{currentUser.name} ({currentUser.role.toUpperCase()})</span>
        </div>
        <div className="text-[11px] text-slate-400 font-medium font-mono">
          Last Synced: {new Date().toISOString().split('T')[0]} 13:06
        </div>
      </footer>

    </div>
  );
}
