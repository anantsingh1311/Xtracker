// import logo from './logo.svg';
import './App.css';
import { BrowserRouter as Router,Routes, Route } from "react-router-dom";

import Navbar from "./components/navbar.component";
import ExercisesList from "./components/excercises-list.component";
import Home from "./components/home.component"
import EditExercise from "./components/edit-excercises-list.component";
import CreateExercise from "./components/create-excercises-list.component";
import ExerciseLibrary from "./components/exercise-library.component";
import CreateUser from "./components/create-user.component";
import LoginUser from "./components/login-user.component";
import ProtectedRoute from "./components/protected-route.component";
import CustomExerciseManager from "./components/custom-exercise.component";
import Chatbot from './components/chatbot';
import ToastHost from "./components/toast.component";
import FitnessProfile from "./components/fitness-profile.component";
import AdminDashboard from "./components/admin-dashboard.component";
import BillingPlans from "./components/billing-plans.component";

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <main className="page-fade mx-auto w-full max-w-7xl px-3 pb-10 pt-4 sm:px-5 lg:px-8">
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/Excercises" element={<ProtectedRoute><ExercisesList/></ProtectedRoute>} />
            <Route path="/exercise-library" element={<ProtectedRoute><ExerciseLibrary /></ProtectedRoute>} />
            <Route path="/login-user" element={<LoginUser />} />
            <Route path="/plans" element={<BillingPlans />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin requireProfile={false}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute requireProfile={false}><FitnessProfile /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><EditExercise /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateExercise /></ProtectedRoute>} />
            <Route path="/custom-exercises/new" element={<ProtectedRoute><CustomExerciseManager /></ProtectedRoute>} />
            <Route path="/user" element={<CreateUser />} />
          </Routes>
        </main>
      </div>
      <div>
      <Chatbot/>
      </div>
      <ToastHost />
    </Router>
  );
}

export default App;
