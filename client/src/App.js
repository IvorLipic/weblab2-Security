import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button, Form, Container, Card, Navbar, Nav, CardTitle } from "react-bootstrap";
import './App.css';

function App() {
  const [sqli, setSqli] = useState(false);
  const [brokenAuth, setBrokenAuth] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [attackInProgress, setAttackInProgress] = useState(false);
  const passwordAttempts = ["123", "1234", "pass", "password", "passw", "pwd", "letmein", "qwerty", "abc123", "12345"];

  const toggleSqli = () => setSqli(!sqli);

  // POST request to /api/toggle-password with new broken auth flag
  const toggleBrokenAuth = async (e) => {
    e.preventDefault();

    let newBrokenAuth = !brokenAuth;
    setBrokenAuth(newBrokenAuth);
    try {
      const response = await axios.post("/api/toggle-password", {
          brokenAuth: newBrokenAuth,
      });
      setResult(response.data.message);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "An error occurred");
    }
  };

  // POST request to /api/sql-injection with query data and injection enabled/disabled flag
  const handleSQLInjection = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("/api/sql-injection", {
        inputQuery: queryInput,
        sqli: sqli,
      });
      setResult(response.data);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "An error occurred");
    }
  };

  // POST request to /api/login with user credentials
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("/api/login", {
        username: username,
        password: password
      });
      setResult(response.data);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "An error occurred");
    }
  };

  /* 
    Function that simulates brute-force attack. 

    "attackInProgress" sets the action button to disabled state while attack is in progress,
    "result" is an array holding formated responses from the server
  */
  const simulateAttack = async () => {
    setAttackInProgress(true);
    setResult([]);
    setErrorMessage("");

    // Permutate the known passwords array
    for (let i = passwordAttempts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordAttempts[i], passwordAttempts[j]] = [passwordAttempts[j], passwordAttempts[i]];
    }

    // For each password call the login API
    for (let i = 0; i < passwordAttempts.length; i++) {
      const passwordAttempt = passwordAttempts[i];

      try {
        const response = await axios.post("/api/login", {
          username: "admin",
          password: passwordAttempt
        });
        // If successful login stop the attack and display success
        if (response.data.message === "Login successful") {
          setResult(`Successful login with password: ${passwordAttempt}`);
          break;
        // If not update the result array with current attempt
        } else {
          setResult(prev => [...prev, `Attempt ${i + 1}: Failed - Password: ${passwordAttempt}`]);
        }
      } catch (err) {
        setResult(prev => [...prev, `Attempt ${i + 1}: Failed - ${err.response?.data?.message || "An error occurred"}`]);
      }

      // Wait 500ms before launching next iteration
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setAttackInProgress(false);
  };

  // Executes on component load, sets the brokenAuth flag on the server to false (default)
  useEffect(() => {
    const setBrokenAuthToFalse = async () => {
      try {
        const response = await axios.post("/api/toggle-password", {
            brokenAuth: false,
        });
        setResult(response.data.message);
      } catch (err) {
        setErrorMessage(err.response?.data?.message || "An error occurred");
      }
    }
    setBrokenAuthToFalse();
  }, []);

  return (
    <div className="App">
      {/* Navbar with goofy title and SQL injection and Broken Auth toggles */}
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-5">
        <Container>
          <Navbar.Brand><h2>Bad app!</h2></Navbar.Brand>
          <Nav className="ml-auto">
            <Form.Check 
              type="checkbox"
              label="Toggle SQL Injection"
              checked={sqli}
              onChange={toggleSqli}
              className="text-white mx-4" 
            />
            <Form.Check 
              type="checkbox"
              label="Toggle Broken Authentication"
              checked={brokenAuth}
              onChange={toggleBrokenAuth}
              className="text-white"
            />
          </Nav>
        </Container>
      </Navbar>
      
      <Container>

        {/* SQL injection container (input and button) */}
        <Card className="p-4" bg={sqli ? "warning" : "white"}>
          <Form onSubmit={handleSQLInjection}>
            <Form.Group controlId="injectionInput">
              <Form.Label className="d-flex text-left"><h2>SQL Injection</h2></Form.Label>
              <Form.Control
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="' OR 1 = '1"
                  size="lg"
                />
            </Form.Group>
            <Button variant="dark" type="submit" className="mt-4" size="lg">
              Inject
            </Button>
          </Form>
        </Card> 

        {/* Results container */}
        <Card className="p-4 d-flex text-left mt-4 mb-4">
          <CardTitle><h3>Results:</h3></CardTitle>
          {errorMessage ? (
            <p style={{ color: "red" }}>{errorMessage}</p>
          ) : (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          )}
        </Card>
        
        {/* Brokent Auth container (2 inputs and button) */}
        <Card className="p-4" bg={brokenAuth ? "warning" : "white"}>
          <CardTitle className="d-flex text-left"><h2>Broken Authentication</h2></CardTitle>
          <Form onSubmit={handleLogin} className="mt-4">
            <Form.Group controlId="brokenAuthInput">
              <Form.Label className="d-flex text-left"><h4>Username:</h4></Form.Label>
              <Form.Control
                 type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                size="lg"
              />
              <Form.Label className="d-flex text-left font-italic mt-4"><h4>Password:</h4></Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size="lg"
              />
            </Form.Group>
            <Button variant="dark" type="submit" className="mt-4" size="lg">
              Login
            </Button>
          </Form>
        </Card>
        
        {/* Attack button */}
        <Button variant="danger" onClick={simulateAttack} disabled={attackInProgress} size="lg" className="m-4">
                Simulate Login Attack
        </Button>

      </Container>
    </div>
  );
}

export default App;
