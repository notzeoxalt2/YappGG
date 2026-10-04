using System.Text.Json;
namespace MicOnly;
static class CleanupTest{
 public static object Run(){using var engine=new MicEngine();var before=engine.Snapshot();
  try{
   foreach(var key in new[]{"NoiseCancelingState","NoiseGateState","NoiseGateAutoThreshold","CaptureParametricEqState","CaptureCompressorState","CaptureAmbientNoiseReductionState","ImpactNoiseReductionState"})engine.Set(key,false);
   engine.Set("CaptureState",true);
   object Measure(){using var cleanup=new NativeCleanup("{0.0.1.00000000}.{943c2a2c-84c0-4d35-b7ea-2402157ebc1f}",48000);var values=new float[960];
    for(int block=0;block<120;block++){for(int i=0;i<480;i++)values[2*i]=values[2*i+1]=.1f*MathF.Sin(2*MathF.PI*1000*(block*480+i)/48000);cleanup.Process(values,480);Thread.Sleep(10);}
    return new{peak=values.Max(x=>Math.Abs(x)),rms=Math.Sqrt(values.Select(x=>x*x).Average())};}
   var disabled=engine.Snapshot();var bypass=Measure();for(int i=1;i<=10;i++)engine.Set("CaptureParametricEqFilter"+i+"State",i==3);
   engine.Set("CaptureParametricEqFilter3FreqHz",1000f);engine.Set("CaptureParametricEqFilter3GainDb",12f);engine.Set("CaptureParametricEqFilter3Type",7);engine.Set("CaptureParametricEqState",true);
   var boosted=Measure();return new{before,disabled,bypass,boosted};
  }finally{engine.Restore(before);}
 }
}
