import { useEffect, useState, useCallback, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Download, QrCode, Phone, PhoneOff, PhoneIncoming, Settings, History, Shield, Clock, User, LogOut, RefreshCw, Copy, Video, VideoOff, Mic, MicOff, X, Check, Loader2, Ban, Trash2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AUTH_URL = "https://auth.emergentagent.com";

// Auth Context
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    window.location.href = `${AUTH_URL}/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
      window.location.href = "/";
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return { user, loading, checkAuth, login, logout, setUser };
};

// Landing Page
const LandingPage = ({ onLogin }) => {
  return (
    <div className="landing-page" data-testid="landing-page">
      <nav className="landing-nav">
        <div className="nav-brand">
          <Bell className="w-8 h-8 text-teal-500" />
          <span className="brand-text">ScanBell</span>
        </div>
        <Button onClick={onLogin} className="login-btn" data-testid="login-button">
          Get Started
        </Button>
      </nav>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-content">
            <Badge className="hero-badge" variant="secondary">Smart Doorbell Solution</Badge>
            <h1 className="hero-title">
              Your Door, <span className="text-gradient">Smarter</span>
            </h1>
            <p className="hero-subtitle">
              Transform any door into a smart doorbell. Generate a QR code, print it, and receive video calls from visitors instantly. No hardware required.
            </p>
            <div className="hero-actions">
              <Button size="lg" onClick={onLogin} className="cta-primary" data-testid="hero-cta">
                Create Your QR Doorbell
              </Button>
              <Button size="lg" variant="outline" className="cta-secondary">
                See How It Works
              </Button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="qr-demo-card">
              <div className="qr-frame">
                <QRCodeSVG value="https://scanbell.app/demo" size={180} />
              </div>
              <p className="qr-label">Scan to Ring</p>
            </div>
          </div>
        </section>

        <section className="features-section">
          <h2 className="section-title">Why ScanBell?</h2>
          <div className="features-grid">
            <Card className="feature-card">
              <CardHeader>
                <div className="feature-icon">
                  <QrCode className="w-6 h-6" />
                </div>
                <CardTitle>Custom QR Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Design your unique QR code with custom colors, logo, and instructions. Download as PDF or PNG.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardHeader>
                <div className="feature-icon">
                  <Video className="w-6 h-6" />
                </div>
                <CardTitle>Browser Video Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  No app needed. They scan, click, and video call you directly in their browser.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardHeader>
                <div className="feature-icon">
                  <Shield className="w-6 h-6" />
                </div>
                <CardTitle>Privacy Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Set availability hours, block unwanted callers, and track all call attempts for your safety.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardHeader>
                <div className="feature-icon">
                  <Clock className="w-6 h-6" />
                </div>
                <CardTitle>Use Forever</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  No subscriptions. Pay once and use your smart doorbell forever. Print, stick, and done.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="cta-section">
          <Card className="cta-card">
            <CardContent className="cta-content">
              <h2>Ready to make your door smart?</h2>
              <p>Join thousands of renters and small businesses using ScanBell.</p>
              <Button size="lg" onClick={onLogin} data-testid="bottom-cta">
                Get Started Free
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; 2025 ScanBell. Smart doorbell, simplified.</p>
      </footer>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ user, onLogout }) => {
  const [doorbellSettings, setDoorbellSettings] = useState(null);
  const [qrSettings, setQrSettings] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [callStats, setCallStats] = useState({ total: 0, answered: 0, missed: 0, blocked: 0 });
  const [activeTab, setActiveTab] = useState("qr");
  const [incomingCall, setIncomingCall] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [pollingInterval, setPollingIntervalState] = useState(null);
  const offerPollingRef = useRef(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, qrRes, historyRes, statsRes] = await Promise.all([
        axios.get(`${API}/doorbell/settings`, { withCredentials: true }),
        axios.get(`${API}/qr/settings`, { withCredentials: true }),
        axios.get(`${API}/calls/history`, { withCredentials: true }),
        axios.get(`${API}/calls/stats`, { withCredentials: true })
      ]);
      setDoorbellSettings(settingsRes.data);
      setQrSettings(qrRes.data);
      setCallHistory(historyRes.data);
      setCallStats(statsRes.data);
    } catch (e) {
      console.error("Error fetching data:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for incoming calls
  useEffect(() => {
    if (!user || isInCall) return;

    const pollForCalls = async () => {
      try {
        const response = await axios.get(
          `${API}/signaling/poll/${user.id}?sender_type=owner`,
          { withCredentials: true }
        );
        const messages = response.data.messages || [];
        
        for (const msg of messages) {
          if (msg.message_type === "ring" && !incomingCall) {
            setIncomingCall({
              visitorName: msg.payload.visitor_name || "Unknown Visitor",
              callId: msg.payload.call_id,
              roomId: msg.room_id
            });
            toast.info("Incoming call!", { duration: 10000 });
          }
        }
      } catch (e) {
        // Silently fail polling
      }
    };

    const interval = setInterval(pollForCalls, 2000);
    setPollingIntervalState(interval);
    return () => clearInterval(interval);
  }, [user, isInCall, incomingCall]);

  // Update doorbell settings
  const updateDoorbellSettings = async (updates) => {
    try {
      const response = await axios.put(`${API}/doorbell/settings`, updates, { withCredentials: true });
      setDoorbellSettings(response.data);
      toast.success("Settings updated!");
    } catch (e) {
      toast.error("Failed to update settings");
    }
  };

  // Update QR settings
  const updateQRSettings = async (updates) => {
    try {
      const response = await axios.put(`${API}/qr/settings`, updates, { withCredentials: true });
      setQrSettings(response.data);
      toast.success("QR settings updated!");
    } catch (e) {
      toast.error("Failed to update QR settings");
    }
  };

  // Regenerate link
  const regenerateLink = async () => {
    try {
      const response = await axios.post(`${API}/doorbell/regenerate-link`, {}, { withCredentials: true });
      setDoorbellSettings(prev => ({ ...prev, call_link: response.data.call_link }));
      toast.success("New link generated!");
    } catch (e) {
      toast.error("Failed to regenerate link");
    }
  };

  // Copy link to clipboard
  const copyLink = () => {
    const fullUrl = `${window.location.origin}${doorbellSettings?.call_link}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Link copied!");
  };

  // Download QR as PNG
  const downloadPNG = async () => {
    const element = document.getElementById("qr-download-target");
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { quality: 1, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = "scanbell-qr.png";
      link.href = dataUrl;
      link.click();
      toast.success("PNG downloaded!");
    } catch (e) {
      toast.error("Failed to download PNG");
    }
  };

  // Download QR as PDF
  const downloadPDF = async () => {
    const element = document.getElementById("qr-download-target");
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { quality: 1, pixelRatio: 3 });
      const pdf = new jsPDF();
      const imgWidth = 100;
      const imgHeight = 120;
      const x = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
      const y = 40;
      
      pdf.setFontSize(24);
      pdf.text("ScanBell QR Code", pdf.internal.pageSize.getWidth() / 2, 25, { align: "center" });
      pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight);
      pdf.setFontSize(12);
      pdf.text("Print this and place near your door.", pdf.internal.pageSize.getWidth() / 2, y + imgHeight + 20, { align: "center" });
      pdf.save("scanbell-qr.pdf");
      toast.success("PDF downloaded!");
    } catch (e) {
      toast.error("Failed to download PDF");
    }
  };

  // Accept call
  const acceptCall = async () => {
    if (!incomingCall) return;
    
    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      
      // Queue for ICE candidates received before remote description
      const iceCandidateQueue = [];
      let remoteDescriptionSet = false;
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };
      
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await axios.post(`${API}/signaling/send`, {
              room_id: incomingCall.roomId,
              sender_type: "owner",
              message_type: "ice-candidate",
              payload: { candidate: event.candidate, call_id: incomingCall.callId }
            }, { withCredentials: true });
          } catch (err) {
            console.error("Error sending ICE candidate:", err);
          }
        }
      };
      
      setPeerConnection(pc);
      setIsInCall(true);
      
      // Send accept signal
      await axios.post(`${API}/signaling/send`, {
        room_id: incomingCall.roomId,
        sender_type: "owner",
        message_type: "accept",
        payload: { call_id: incomingCall.callId }
      }, { withCredentials: true });
      
      // Start polling for offer
      offerPollingRef.current = setInterval(async () => {
        const response = await axios.get(
          `${API}/signaling/poll/${incomingCall.roomId}?sender_type=owner`,
          { withCredentials: true }
        );
        
        for (const msg of response.data.messages || []) {
          if (msg.message_type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
            remoteDescriptionSet = true;
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            await axios.post(`${API}/signaling/send`, {
              room_id: incomingCall.roomId,
              sender_type: "owner",
              message_type: "answer",
              payload: { sdp: answer, call_id: incomingCall.callId }
            }, { withCredentials: true });
            
            // Process queued ICE candidates
            while (iceCandidateQueue.length > 0) {
              const candidate = iceCandidateQueue.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.error("Error adding queued ICE candidate:", e);
              }
            }
          } else if (msg.message_type === "ice-candidate" && msg.payload.candidate) {
            if (remoteDescriptionSet) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
              } catch (e) {
                console.error("Error adding ICE candidate:", e);
              }
            } else {
              // Queue the candidate until remote description is set
              iceCandidateQueue.push(msg.payload.candidate);
            }
          } else if (msg.message_type === "end") {
            endCall();
            if (offerPollingRef.current) {
              clearInterval(offerPollingRef.current);
              offerPollingRef.current = null;
            }
          }
        }
      }, 1000);
      
      setIncomingCall(null);
    } catch (e) {
      console.error("Error accepting call:", e);
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        toast.error("Camera/microphone permission denied. Please allow access and try again.");
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        toast.error("No camera or microphone found. Please connect a device and try again.");
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        toast.error("Camera/microphone is already in use by another application.");
      } else {
        toast.error("Failed to start call. Please check your camera and microphone.");
      }
      setIsInCall(false);
      setIncomingCall(null);
    }
  };

  // Reject call
  const rejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      await axios.post(`${API}/signaling/send`, {
        room_id: incomingCall.roomId,
        sender_type: "owner",
        message_type: "reject",
        payload: { call_id: incomingCall.callId }
      }, { withCredentials: true });
    } catch (e) {
      console.error("Error rejecting call:", e);
    }
    
    setIncomingCall(null);
    fetchData(); // Refresh call history
  };

  // End call
  const endCall = async () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (offerPollingRef.current) {
      clearInterval(offerPollingRef.current);
      offerPollingRef.current = null;
    }
    setRemoteStream(null);
    setIsInCall(false);
    setIncomingCall(null);
    fetchData(); // Refresh call history
  };

  // Delete call
  const deleteCall = async (callId) => {
    try {
      await axios.delete(`${API}/calls/${callId}`, { withCredentials: true });
      setCallHistory(prev => prev.filter(c => c.id !== callId));
      toast.success("Call deleted");
    } catch (e) {
      toast.error("Failed to delete call");
    }
  };

  // Block IP
  const blockIP = async (ip) => {
    try {
      await axios.post(`${API}/doorbell/block`, { ip }, { withCredentials: true });
      fetchData();
      toast.success("IP blocked");
    } catch (e) {
      toast.error("Failed to block IP");
    }
  };

  // Unblock IP
  const unblockIP = async (ip) => {
    try {
      await axios.post(`${API}/doorbell/unblock`, { ip }, { withCredentials: true });
      fetchData();
      toast.success("IP unblocked");
    } catch (e) {
      toast.error("Failed to unblock IP");
    }
  };

  const callUrl = doorbellSettings ? `${window.location.origin}${doorbellSettings.call_link}` : "";

  if (!doorbellSettings || !qrSettings) {
    return (
      <div className="loading-container">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard" data-testid="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <Bell className="w-7 h-7 text-teal-500" />
          <span>ScanBell</span>
        </div>
        <div className="header-user">
          <div className="user-info">
            {user.picture && <img src={user.picture} alt={user.name} className="user-avatar" />}
            <span className="user-name">{user.name}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="logout-button">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Incoming Call Dialog */}
      <Dialog open={!!incomingCall} onOpenChange={() => {}}>
        <DialogContent className="incoming-call-dialog" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="incoming-call-title">
              <PhoneIncoming className="w-8 h-8 text-teal-500 animate-pulse" />
              Incoming Call
            </DialogTitle>
            <DialogDescription>
              {incomingCall?.visitorName} is at your door
            </DialogDescription>
          </DialogHeader>
          <div className="incoming-call-actions">
            <Button variant="destructive" size="lg" onClick={rejectCall} data-testid="reject-call">
              <PhoneOff className="w-5 h-5 mr-2" />
              Decline
            </Button>
            <Button size="lg" className="accept-btn" onClick={acceptCall} data-testid="accept-call">
              <Phone className="w-5 h-5 mr-2" />
              Answer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Call View */}
      {isInCall && (
        <div className="active-call-overlay" data-testid="active-call">
          <div className="video-grid">
            <div className="remote-video-container">
              {remoteStream ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => el && (el.srcObject = remoteStream)}
                  className="remote-video"
                />
              ) : (
                <div className="video-placeholder">
                  <User className="w-16 h-16" />
                  <p>Waiting for visitor...</p>
                </div>
              )}
            </div>
            <div className="local-video-container">
              {localStream && (
                <video
                  autoPlay
                  playsInline
                  muted
                  ref={(el) => el && (el.srcObject = localStream)}
                  className="local-video"
                />
              )}
            </div>
          </div>
          <div className="call-controls">
            <Button variant="destructive" size="lg" onClick={endCall} data-testid="end-call">
              <PhoneOff className="w-5 h-5 mr-2" />
              End Call
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Stats Cards */}
        <div className="stats-grid">
          <Card className="stat-card">
            <CardContent className="stat-content">
              <div className="stat-icon total"><Phone className="w-5 h-5" /></div>
              <div className="stat-info">
                <span className="stat-value">{callStats.total}</span>
                <span className="stat-label">Total Calls</span>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="stat-content">
              <div className="stat-icon answered"><Check className="w-5 h-5" /></div>
              <div className="stat-info">
                <span className="stat-value">{callStats.answered}</span>
                <span className="stat-label">Answered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="stat-content">
              <div className="stat-icon missed"><X className="w-5 h-5" /></div>
              <div className="stat-info">
                <span className="stat-value">{callStats.missed}</span>
                <span className="stat-label">Missed</span>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="stat-content">
              <div className="stat-icon blocked"><Ban className="w-5 h-5" /></div>
              <div className="stat-info">
                <span className="stat-value">{callStats.blocked}</span>
                <span className="stat-label">Blocked</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="dashboard-tabs">
          <TabsList className="tabs-list">
            <TabsTrigger value="qr" data-testid="tab-qr">
              <QrCode className="w-4 h-4 mr-2" />QR Code
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />Settings
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />History
            </TabsTrigger>
            <TabsTrigger value="privacy" data-testid="tab-privacy">
              <Shield className="w-4 h-4 mr-2" />Privacy
            </TabsTrigger>
          </TabsList>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="tab-content">
            <div className="qr-section">
              <Card className="qr-preview-card">
                <CardHeader>
                  <CardTitle>Your QR Code</CardTitle>
                  <CardDescription>Visitors scan this to ring your doorbell</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    id="qr-download-target"
                    className="qr-preview"
                    style={{ borderColor: qrSettings.frame_color }}
                  >
                    <div className="qr-inner" style={{ backgroundColor: qrSettings.frame_color }}>
                      <div className="qr-white-bg">
                        <QRCodeSVG value={callUrl} size={160} />
                      </div>
                      <p className="qr-instruction" style={{ color: "white" }}>
                        {qrSettings.instruction_text}
                      </p>
                    </div>
                  </div>
                  <div className="qr-actions">
                    <Button onClick={downloadPNG} data-testid="download-png">
                      <Download className="w-4 h-4 mr-2" />PNG
                    </Button>
                    <Button onClick={downloadPDF} variant="outline" data-testid="download-pdf">
                      <Download className="w-4 h-4 mr-2" />PDF
                    </Button>
                    <Button onClick={copyLink} variant="outline" data-testid="copy-link">
                      <Copy className="w-4 h-4 mr-2" />Copy Link
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="qr-customize-card">
                <CardHeader>
                  <CardTitle>Customize</CardTitle>
                  <CardDescription>Make your QR code unique</CardDescription>
                </CardHeader>
                <CardContent className="customize-form">
                  <div className="form-group">
                    <Label htmlFor="frame-color">Frame Color</Label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        id="frame-color"
                        value={qrSettings.frame_color}
                        onChange={(e) => updateQRSettings({ frame_color: e.target.value })}
                        className="color-picker"
                        data-testid="frame-color-input"
                      />
                      <Input
                        value={qrSettings.frame_color}
                        onChange={(e) => updateQRSettings({ frame_color: e.target.value })}
                        className="color-text"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <Label htmlFor="instruction">Scan Instruction</Label>
                    <Input
                      id="instruction"
                      value={qrSettings.instruction_text}
                      onChange={(e) => updateQRSettings({ instruction_text: e.target.value })}
                      placeholder="Scan to Ring"
                      data-testid="instruction-input"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="tab-content">
            <Card>
              <CardHeader>
                <CardTitle>Doorbell Settings</CardTitle>
                <CardDescription>Configure how visitors see your doorbell</CardDescription>
              </CardHeader>
              <CardContent className="settings-form">
                <div className="form-group">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    value={doorbellSettings.display_name}
                    onChange={(e) => updateDoorbellSettings({ display_name: e.target.value })}
                    placeholder="My Home"
                    data-testid="display-name-input"
                  />
                </div>

                <Separator />

                <div className="form-group">
                  <Label>Your Doorbell Link</Label>
                  <div className="link-group">
                    <Input value={callUrl} readOnly className="link-input" />
                    <Button variant="outline" onClick={copyLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" data-testid="regenerate-link">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Regenerate Link?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will create a new link. Your old QR code will no longer work.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={regenerateLink}>Regenerate</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="tab-content">
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>Recent visitors to your doorbell</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="history-scroll">
                  {callHistory.length === 0 ? (
                    <div className="empty-state">
                      <History className="w-12 h-12 text-gray-300" />
                      <p>No calls yet</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {callHistory.map((call) => (
                        <div key={call.id} className="history-item">
                          <div className="history-info">
                            <div className="history-header">
                              <span className="history-name">{call.visitor_name || "Unknown"}</span>
                              <Badge
                                variant={call.status === "answered" ? "default" : call.status === "blocked" ? "destructive" : "secondary"}
                              >
                                {call.status}
                              </Badge>
                            </div>
                            <span className="history-time">
                              {new Date(call.created_at).toLocaleString()}
                            </span>
                            {call.duration_seconds > 0 && (
                              <span className="history-duration">
                                Duration: {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, "0")}
                              </span>
                            )}
                          </div>
                          <div className="history-actions">
                            {call.visitor_ip && call.status !== "blocked" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => blockIP(call.visitor_ip)}
                                title="Block this caller"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCall(call.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="tab-content">
            <div className="privacy-section">
              <Card>
                <CardHeader>
                  <CardTitle>Availability Hours</CardTitle>
                  <CardDescription>Set when visitors can ring your doorbell</CardDescription>
                </CardHeader>
                <CardContent className="availability-form">
                  <div className="switch-group">
                    <div className="switch-info">
                      <Label htmlFor="availability">Enable Availability Hours</Label>
                      <p className="switch-description">Visitors outside these hours will see a message</p>
                    </div>
                    <Switch
                      id="availability"
                      checked={doorbellSettings.availability_enabled}
                      onCheckedChange={(checked) => updateDoorbellSettings({ availability_enabled: checked })}
                      data-testid="availability-switch"
                    />
                  </div>
                  
                  {doorbellSettings.availability_enabled && (
                    <div className="time-range">
                      <div className="form-group">
                        <Label htmlFor="start-time">Start Time</Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={doorbellSettings.availability_start}
                          onChange={(e) => updateDoorbellSettings({ availability_start: e.target.value })}
                          data-testid="start-time-input"
                        />
                      </div>
                      <div className="form-group">
                        <Label htmlFor="end-time">End Time</Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={doorbellSettings.availability_end}
                          onChange={(e) => updateDoorbellSettings({ availability_end: e.target.value })}
                          data-testid="end-time-input"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Blocked Callers</CardTitle>
                  <CardDescription>These IPs cannot ring your doorbell</CardDescription>
                </CardHeader>
                <CardContent>
                  {doorbellSettings.blocked_ips?.length === 0 ? (
                    <div className="empty-state small">
                      <Shield className="w-8 h-8 text-gray-300" />
                      <p>No blocked callers</p>
                    </div>
                  ) : (
                    <div className="blocked-list">
                      {doorbellSettings.blocked_ips?.map((ip) => (
                        <div key={ip} className="blocked-item">
                          <span>{ip}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblockIP(ip)}
                          >
                            Unblock
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Visitor Call Page
const VisitorCallPage = () => {
  const { userId } = useParams();
  const [doorbellInfo, setDoorbellInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [callState, setCallState] = useState("idle"); // idle, ringing, connected, ended, rejected
  const [visitorName, setVisitorName] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [callId, setCallId] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [iceCandidateQueue, setIceCandidateQueue] = useState([]);
  const [remoteDescSet, setRemoteDescSet] = useState(false);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await axios.get(`${API}/call/info/${userId}`);
        setDoorbellInfo(response.data);
      } catch (e) {
        if (e.response?.status === 403) {
          setError("You have been blocked from this doorbell.");
        } else if (e.response?.status === 404) {
          setError("Doorbell not found.");
        } else {
          setError("Failed to load doorbell info.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [userId]);

  const ringDoorbell = async () => {
    if (!visitorName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    try {
      // Send ring signal
      const response = await axios.post(`${API}/signaling/send`, {
        room_id: userId,
        sender_type: "visitor",
        message_type: "ring",
        payload: { visitor_name: visitorName }
      });
      
      setCallId(response.data.message_id);
      setCallState("ringing");
      toast.info("Ringing...");
      
      // Start polling for response
      let callAccepted = false;
      
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const pollResponse = await axios.get(
            `${API}/signaling/poll/${userId}?sender_type=visitor`
          );
          
          for (const msg of pollResponse.data.messages || []) {
            if (msg.message_type === "accept" && !callAccepted) {
              callAccepted = true;
              setCallId(msg.payload.call_id);
              await startCall();
              // Continue polling for answer and ICE candidates
            } else if (msg.message_type === "reject") {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setCallState("rejected");
              toast.error("Call was declined");
            } else if (msg.message_type === "answer") {
              setPeerConnection(prevPc => {
                if (prevPc && prevPc.signalingState !== "closed") {
                  prevPc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp))
                    .then(() => {
                      setRemoteDescSet(true);
                      // Process queued ICE candidates
                      setIceCandidateQueue(prevQueue => {
                        prevQueue.forEach(candidate => {
                          prevPc.addIceCandidate(new RTCIceCandidate(candidate))
                            .catch(e => console.error("Error adding queued ICE candidate:", e));
                        });
                        return [];
                      });
                    })
                    .catch(e => console.error("Error setting remote description:", e));
                }
                return prevPc;
              });
            } else if (msg.message_type === "ice-candidate" && msg.payload.candidate) {
              if (remoteDescSet) {
                setPeerConnection(prevPc => {
                  if (prevPc && prevPc.signalingState !== "closed") {
                    prevPc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate))
                      .catch(e => console.error("Error adding ICE candidate:", e));
                  }
                  return prevPc;
                });
              } else {
                // Queue the candidate until remote description is set
                setIceCandidateQueue(prev => [...prev, msg.payload.candidate]);
              }
            } else if (msg.message_type === "end") {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              endCall();
            }
          }
        } catch (e) {
          // Silently fail polling
        }
      }, 1000);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (callState === "ringing") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setCallState("ended");
          toast.error("No answer");
        }
      }, 60000);
    } catch (e) {
      if (e.response?.status === 403) {
        setError("You have been blocked from this doorbell.");
      } else {
        toast.error("Failed to ring doorbell");
      }
    }
  };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setCallStartTime(Date.now());

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await axios.post(`${API}/signaling/send`, {
              room_id: userId,
              sender_type: "visitor",
              message_type: "ice-candidate",
              payload: { candidate: event.candidate }
            });
          } catch (err) {
            console.error("Error sending ICE candidate:", err);
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await axios.post(`${API}/signaling/send`, {
        room_id: userId,
        sender_type: "visitor",
        message_type: "offer",
        payload: { sdp: offer }
      });

      setPeerConnection(pc);
      setCallState("connected");
    } catch (e) {
      console.error("Error starting call:", e);
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        toast.error("Camera/microphone permission denied. Please allow access and try again.");
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        toast.error("No camera or microphone found. Please connect a device and try again.");
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        toast.error("Camera/microphone is already in use by another application.");
      } else {
        toast.error("Failed to start video call. Please check your camera and microphone.");
      }
      setCallState("ended");
    }
  };

  const endCall = async () => {
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    
    if (callId) {
      try {
        await axios.post(`${API}/signaling/end-call`, {
          call_id: callId,
          duration_seconds: duration
        });
        
        await axios.post(`${API}/signaling/send`, {
          room_id: userId,
          sender_type: "visitor",
          message_type: "end",
          payload: { call_id: callId }
        });
      } catch (e) {
        // Silently fail
      }
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setRemoteStream(null);
    setCallState("ended");
    setIceCandidateQueue([]);
    setRemoteDescSet(false);
  };

  if (loading) {
    return (
      <div className="visitor-page loading" data-testid="visitor-loading">
        <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
        <p>Loading doorbell...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="visitor-page error" data-testid="visitor-error">
        <X className="w-16 h-16 text-red-500" />
        <h2>{error}</h2>
      </div>
    );
  }

  if (!doorbellInfo?.available) {
    return (
      <div className="visitor-page unavailable" data-testid="visitor-unavailable">
        <Clock className="w-16 h-16 text-amber-500" />
        <h2>{doorbellInfo?.display_name}</h2>
        <p>{doorbellInfo?.message || "Currently unavailable"}</p>
      </div>
    );
  }

  return (
    <div className="visitor-page" data-testid="visitor-page">
      {callState === "connected" ? (
        <div className="visitor-call-view">
          <div className="visitor-video-grid">
            <div className="visitor-remote-video">
              {remoteStream ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => el && (el.srcObject = remoteStream)}
                />
              ) : (
                <div className="video-placeholder">
                  <User className="w-16 h-16" />
                  <p>Connecting...</p>
                </div>
              )}
            </div>
            <div className="visitor-local-video">
              {localStream && (
                <video
                  autoPlay
                  playsInline
                  muted
                  ref={(el) => el && (el.srcObject = localStream)}
                />
              )}
            </div>
          </div>
          <Button variant="destructive" size="lg" onClick={endCall} className="end-call-btn" data-testid="visitor-end-call">
            <PhoneOff className="w-5 h-5 mr-2" />End Call
          </Button>
        </div>
      ) : (
        <Card className="visitor-card">
          <CardHeader className="visitor-card-header">
            <div className="doorbell-icon">
              <Bell className="w-10 h-10 text-teal-500" />
            </div>
            <CardTitle>{doorbellInfo?.display_name}</CardTitle>
            <CardDescription>
              {doorbellInfo?.owner_name}&apos;s Doorbell
            </CardDescription>
          </CardHeader>
          <CardContent className="visitor-card-content">
            {callState === "idle" && (
              <>
                <div className="form-group">
                  <Label htmlFor="visitor-name">Your Name</Label>
                  <Input
                    id="visitor-name"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="Enter your name"
                    data-testid="visitor-name-input"
                  />
                </div>
                <Button
                  size="lg"
                  className="ring-btn"
                  onClick={ringDoorbell}
                  data-testid="ring-button"
                >
                  <Bell className="w-5 h-5 mr-2" />Ring Doorbell
                </Button>
              </>
            )}
            {callState === "ringing" && (
              <div className="ringing-state">
                <div className="ringing-animation">
                  <Bell className="w-12 h-12 text-teal-500 animate-ring" />
                </div>
                <p>Ringing...</p>
                <Button variant="outline" onClick={() => setCallState("idle")}>
                  Cancel
                </Button>
              </div>
            )}
            {callState === "rejected" && (
              <div className="rejected-state">
                <PhoneOff className="w-12 h-12 text-red-500" />
                <p>Call was declined</p>
                <Button onClick={() => setCallState("idle")}>Try Again</Button>
              </div>
            )}
            {callState === "ended" && (
              <div className="ended-state">
                <Check className="w-12 h-12 text-teal-500" />
                <p>Call ended</p>
                <Button onClick={() => setCallState("idle")}>Ring Again</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <p className="powered-by">Powered by ScanBell</p>
    </div>
  );
};

// Auth Callback Handler
const AuthCallback = ({ onAuth }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await axios.post(
            `${API}/auth/session`,
            { session_id: sessionId },
            { withCredentials: true }
          );

          console.log("Auth session response:", response.data);
          const { user } = response.data;

          // Register OneSignal User
          if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(async function(OneSignal) {
              try {
                // Login the user to OneSignal if needed, or just use the device/subscription ID
                // For simplicity, we just register the subscription ID with our backend
                const id = OneSignal.User.PushSubscription.id;
                console.log("OneSignal ID:", id);
                
                const registerToken = async (token) => {
                   try {
                     await axios.post(
                        `${API}/notifications/register-token`,
                        { token: token, platform: "web" },
                        { withCredentials: true }
                     );
                     console.log("OneSignal token registered");
                   } catch(e) {
                     console.error("Failed to register OneSignal token", e);
                   }
                };

                if (id) {
                    await registerToken(id);
                }
                
                // Listen for subscription changes
                 OneSignal.User.PushSubscription.addEventListener("change", async function(event) {
                    if (event.current.id) {
                        await registerToken(event.current.id);
                    }
                 });

              } catch (e) {
                console.error("OneSignal error:", e);
              }
            });
          }

          onAuth(user);
          // Clean URL
          window.history.replaceState(null, "", "/dashboard");
        } catch (e) {
          console.error("Auth error:", e);
          toast.error("Authentication failed");
          navigate("/");
        }
      } else {
        navigate("/");
      }
      setProcessing(false);
    };

    processAuth();
  }, [location, navigate, onAuth]);

  if (processing) {
    return (
      <div className="auth-processing">
        <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
        <p>Signing you in...</p>
      </div>
    );
  }

  return null;
};

// Main App
function App() {
  const { user, loading, checkAuth, login, logout, setUser } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="app-loading">
        <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={user ? <Dashboard user={user} onLogout={logout} /> : <LandingPage onLogin={login} />}
          />
          <Route
            path="/dashboard"
            element={
              <AuthCallback onAuth={setUser} />
            }
          />
          <Route path="/call/:userId" element={<VisitorCallPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
